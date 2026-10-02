import "server-only";
import { THIN_CV_CHARS } from "./extract";
import { isAiEnabled, scoreCv } from "./gemini";
import { prepareCv } from "./pii";
import { evaluate, inconsistentCategories, type Role } from "./rubric";
import { getStore } from "./store";
import type { Analysis, Candidate } from "./types";

/** Input -> Context: split contact details from the text the AI may see, then store it. */
export async function ingest(
  fileName: string,
  rawText: string,
  role: Role,
): Promise<{ candidate: Candidate; duplicate: boolean }> {
  const prepared = prepareCv(rawText, fileName);

  // Same person uploaded again (same email, or same file name and CV text): reuse, don't duplicate.
  const existing = (await getStore().list()).find(
    (c) =>
      (prepared.contact.email && c.email?.toLowerCase() === prepared.contact.email.toLowerCase()) ||
      (c.file_name === fileName && c.redacted_text === prepared.redacted),
  );
  if (existing) {
    // New version of the CV: refresh the text and re-score. Same text: reuse, scoring it only if a
    // previous attempt never finished (e.g. it timed out).
    if (existing.redacted_text !== prepared.redacted || existing.role_applied !== role) {
      const refreshed = await getStore().update(existing.id, {
        file_name: fileName,
        role_applied: role,
        ...prepared.contact,
        redacted_text: prepared.redacted,
        removed: prepared.removed,
        analysis: null, // fresh text, so no consistency comparison against the old scores
      });
      return { candidate: await score(refreshed), duplicate: true };
    }
    return { candidate: existing.analysis ? existing : await score(existing), duplicate: true };
  }

  const created = await getStore().create({
    file_name: fileName,
    role_applied: role,
    ...prepared.contact,
    redacted_text: prepared.redacted,
    removed: prepared.removed,
    analysis: null,
    evaluation: null,
    flags: [],
    score_runs: 0,
    error: null,
    decision: "pending",
    decided_at: null,
    email_draft: null,
    email_sent_at: null,
    email_sent_to: null,
    interview_at: null,
    interview_minutes: null,
    interview_mode: null,
    interview_link: null,
  });
  return { candidate: await score(created), duplicate: false };
}

function flagsFor(c: Candidate, a: Analysis, evalFlags: string[], inconsistent: string[]): string[] {
  const f = [...evalFlags];
  if (a.thin_cv || c.redacted_text.length < THIN_CV_CHARS) f.push("needs_human_read");
  for (const r of a.red_flags) f.push(`red_flag: ${r}`);
  if (a.unverified.length) f.push(`unverified_quote: ${a.unverified.join(", ")}`);
  if (inconsistent.length) f.push(`inconsistent: ${inconsistent.join(", ")}`);
  return Array.from(new Set(f));
}

/** Processing + AI: score with the rubric (AI proposes, code decides). Re-running checks rule 7. */
export async function score(c: Candidate): Promise<Candidate> {
  const store = getStore();
  if (!isAiEnabled()) {
    return store.update(c.id, { error: "GEMINI_API_KEY is not set, so this CV hasn't been scored yet." });
  }
  try {
    const analysis = await scoreCv(c.redacted_text, c.role_applied);
    if (c.redacted_text.length < THIN_CV_CHARS) {
      analysis.thin_cv = true;
      analysis.confidence = "low";
    }
    const evaluation = evaluate({
      scores: analysis.scores,
      roleApplied: c.role_applied,
      pmYears: analysis.pm_years,
      location: analysis.location_signal,
      workMode: analysis.work_mode_signal,
    });
    const inconsistent = c.analysis ? inconsistentCategories(c.analysis.scores, analysis.scores) : [];
    return store.update(c.id, {
      analysis,
      evaluation,
      flags: flagsFor(c, analysis, evaluation.flags, inconsistent),
      score_runs: c.score_runs + 1,
      error: null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return store.update(c.id, { error: `Scoring failed: ${msg.slice(0, 300)}` });
  }
}
