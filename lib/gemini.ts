import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { quoteIsInText } from "./pii";
import { CATEGORIES, CATEGORY_IDS, clampScore, type CategoryId, type Role, type Scores } from "./rubric";
import type { Analysis, EmailDraft } from "./types";

/**
 * Gemini does two jobs:
 *   (a) read a redacted CV and propose rubric scores, each backed by an exact quote
 *   (b) draft the invite / rejection email AFTER the founder has decided
 * It never sees names, emails, phones, links or education, and it never decides rank or outcome.
 */

export const isAiEnabled = () => Boolean(process.env.GEMINI_API_KEY);
export const modelName = () => process.env.GEMINI_MODEL || "gemini-flash-latest";

function model(systemInstruction: string, temperature: number) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model: modelName(),
    systemInstruction,
    generationConfig: { responseMimeType: "application/json", temperature },
  });
}

const anchors = `
| ID            | Score 1                          | Score 3                                              | Score 5 |
| ops_ground    | No ops-heavy industry exposure   | Adjacent ops (supply chain, e-commerce fulfilment) or built software for logistics users | Worked inside freight, CHA, port or 3PL operations themselves |
| no_layer      | Always inside a larger team/chain| Owned a module under a senior lead                   | Sole owner, reporting to a founder or CEO |
| built_missing | Ran existing processes only      | Built a tool for self or a small team                | First-of-its-kind system a team adopted as standard |
| hard_calls    | Only wins listed                 | A clear call with a stated rationale                 | Killed or reversed something on data and wrote up why |
| product_craft | No shipping ownership            | Owned features from spec to release                  | Owned a roadmap; shipped features used unprompted |
| crisis        | No incidents described           | Handled an incident inside a team process            | Personally resolved a live ops crisis with no customer loss |
| integrations  | None                             | Worked with APIs or integrations                     | Owned an integration roadmap or build-vs-configure calls |
2 and 4 sit between the anchors.

Evidence cues (cues only; a keyword alone earns nothing, the line must show the behaviour):
ops_ground: CHA, NVOCC, freight forwarder, 3PL, Bill of Lading, JNPT, Nhava Sheva, ICEGATE, CargoWise, customs clearance, carrier allocation, port, DGFT, shipment documentation
no_layer: sole PM, first PM, reports to founder/CEO, independently, no layer, end to end, no manager above
built_missing: built from scratch, first, adopted by, now standard, rolled out to, used by the whole team
hard_calls: killed, deprecated, pivoted, reversed, post-mortem, root cause, retrospective, said no
product_craft: roadmap, discovery, shipped, adoption, PRD, sprint, weekly active use, user interviews
crisis: outage, incident, customs hold, escalation, overnight, no data loss, under time pressure
integrations: API, carrier integration, EDI, ERP, port portal, data migration, build vs configure, platform`;

const SCORE_SYSTEM = `You score CVs for Kargo, a Series A logistics SaaS company in Mumbai (software for freight forwarders and 3PLs).
Roles: Product Manager (PM, 2-4 yrs PM experience) and Senior Product Manager (SPM, 5-8 yrs). Both report directly to the founder, in-office in Mumbai.
The rubric was derived from the founder's best past hires. It rewards what predicted success, not the job spec.

Score each of the 7 categories from 1 to 5 using these anchors:
${anchors}

PRECISION RULES (follow all):
1. No quote, no score. Every score above 1 MUST have "evidence" = one line copied EXACTLY, character for character, from the CV text (you may shorten with "..." between exact fragments). If you cannot quote it, the score is 1 and evidence is "".
2. Blind scoring. The CV has been redacted. Ignore any remaining signal of name, gender, age, photo or college.
3. Do NOT reward: college name, MBA, certifications, raw tech-stack match, or quantified achievements by themselves.
4. Thin, garbled or unreadable CV: set "thin_cv": true and "confidence": "low". Do not just score it low.
5. Red flags lower confidence, they never reject: "only wins listed", "only maintained existing systems", "always several layers below the decision-maker". List any that apply in "red_flags".
6. Probes: write exactly 3 interview questions targeting the candidate's two lowest-scoring categories (for a PM applicant, ignore integrations). Each question must be specific to this CV, not generic.
7. Be consistent: the same CV must always get the same scores.

Also extract:
- pm_years: total years in product-management roles (titles like Product Manager, Product Owner, Associate PM, Head of Product). Count only PM roles, not ops/engineering/analyst years. Use the date ranges; "Present" = September 2026. Round to one decimal. null if not determinable.
- location_signal: "mumbai" (lives in Mumbai / Navi Mumbai / Thane), "willing_to_relocate" (CV explicitly says open to relocating to Mumbai or anywhere), "unwilling" (explicitly refuses relocation), "elsewhere_not_stated" (lives elsewhere, says nothing about relocating), "not_stated".
- work_mode_signal: "in_office_ok", "remote_only" (explicitly only remote), "not_stated".

Respond with JSON exactly in this shape:
{
  "summary": "2-3 sentences: career arc and domain, no names",
  "pm_years": 0, "pm_years_evidence": "exact quote or ''",
  "location_signal": "...", "location_evidence": "exact quote or ''",
  "work_mode_signal": "...",
  "scores": { ${CATEGORY_IDS.map((id) => `"${id}": {"score": 1, "evidence": ""}`).join(", ")} },
  "red_flags": [],
  "thin_cv": false,
  "confidence": "high|medium|low",
  "why_ranked_here": "max 2 sentences on what drives the scores, referring to rubric categories",
  "strengths": ["up to 3 short phrases, non-sensitive, usable in an email to the candidate"],
  "probe_questions": [{"category": "<category id>", "question": "..."}]
}`;

const scoreSchema = z.object({
  score: z.coerce.number().catch(1),
  evidence: z.string().catch(""),
});

const aiSchema = z.object({
  summary: z.string().catch(""),
  pm_years: z.coerce.number().nullable().catch(null),
  pm_years_evidence: z.string().catch(""),
  location_signal: z
    .enum(["mumbai", "willing_to_relocate", "elsewhere_not_stated", "unwilling", "not_stated"])
    .catch("not_stated"),
  location_evidence: z.string().catch(""),
  work_mode_signal: z.enum(["in_office_ok", "remote_only", "not_stated"]).catch("not_stated"),
  scores: z.record(scoreSchema).catch({}),
  red_flags: z.array(z.string()).catch([]),
  thin_cv: z.boolean().catch(false),
  confidence: z.enum(["high", "medium", "low"]).catch("medium"),
  why_ranked_here: z.string().catch(""),
  strengths: z.array(z.string()).catch([]),
  probe_questions: z.array(z.object({ category: z.string(), question: z.string() })).catch([]),
});

/** Parse + enforce rule 1 against the exact text the model saw. Exported for tests. */
export function toAnalysis(raw: unknown, cvText: string, model: string): Analysis {
  const ai = aiSchema.parse(raw);
  const scores = {} as Scores;
  const unverified: CategoryId[] = [];
  for (const id of CATEGORY_IDS) {
    const s = ai.scores[id] ?? { score: 1, evidence: "" };
    let score = clampScore(s.score);
    const evidence = s.evidence.trim();
    if (score > 1 && !quoteIsInText(evidence, cvText)) {
      unverified.push(id);
      score = 1;
    }
    scores[id] = { score, evidence };
  }
  const known = new Set<string>(CATEGORY_IDS);
  let confidence = ai.confidence;
  if (ai.thin_cv) confidence = "low";
  else if (ai.red_flags.length && confidence === "high") confidence = "medium";

  return {
    summary: ai.summary.slice(0, 600),
    pm_years: ai.pm_years === null || !Number.isFinite(ai.pm_years) ? null : Math.max(0, ai.pm_years),
    pm_years_evidence: ai.pm_years_evidence.slice(0, 400),
    location_signal: ai.location_signal,
    location_evidence: ai.location_evidence.slice(0, 400),
    work_mode_signal: ai.work_mode_signal,
    scores,
    unverified,
    red_flags: ai.red_flags.slice(0, 5).map((f) => f.slice(0, 200)),
    thin_cv: ai.thin_cv,
    confidence,
    why_ranked_here: ai.why_ranked_here.slice(0, 500),
    strengths: ai.strengths.slice(0, 3).map((s) => s.slice(0, 120)),
    probe_questions: ai.probe_questions
      .filter((p) => known.has(p.category) && p.question.trim())
      .slice(0, 3)
      .map((p) => ({ category: p.category as CategoryId, question: p.question.trim().slice(0, 400) })),
    model,
    scored_at: new Date().toISOString(),
  };
}

export async function scoreCv(redactedText: string, roleApplied: Role): Promise<Analysis> {
  const m = modelName();
  const prompt = `Role applied for: ${roleApplied === "PM" ? "Product Manager (PM)" : "Senior Product Manager (SPM)"}\n\nCV TEXT (redacted):\n"""\n${redactedText.slice(0, 20000)}\n"""`;
  const res = await model(SCORE_SYSTEM, 0).generateContent(prompt);
  return toAnalysis(JSON.parse(res.response.text()), redactedText, m);
}

// ---------------------------------------------------------------------------------------------
// Emails (drafted only after the founder clicks Advance or Pass)

export const FIRST_NAME = "{{first_name}}";

const EMAIL_SYSTEM = `You write short, warm, specific emails from Arjun Mehta, founder of Kargo (Series A logistics SaaS, Mumbai), to a job applicant.
Rules:
- Address the candidate as ${FIRST_NAME} exactly (it is replaced later). Never invent a name.
- Plain text, no markdown. 90-160 words. Sign off as "Arjun Mehta, Founder, Kargo".
- Use the role title exactly as given (e.g. "Senior Product Manager", never shortened).
- The candidate has ONLY sent a written application. There has been no call, interview or conversation: never say or imply that you spoke, met or talked.
- Mention one or two of the candidate's strengths given to you, in natural words. Never mention scores, rubrics, rankings, AI, or other candidates.
- INVITE: say Arjun would like to meet them for the role. Do NOT state the time, length, place or format yourself: include the scheduling instruction you are given verbatim, as its own paragraph, and it covers all of that.
- REJECTION: kind and clear that Kargo won't move forward with their application for this role right now. Thank them for applying. No vague "we'll keep you on file" promises unless told. No feedback that could read as about age, gender, college or background.
Respond with JSON: {"body": "..."}`;

export function fallbackEmail(kind: EmailDraft["kind"], role: Role, schedule: string): Omit<EmailDraft, "drafted_at"> {
  const roleName = role === "PM" ? "Product Manager" : "Senior Product Manager";
  if (kind === "invite") {
    return {
      kind,
      subject: `Kargo ${roleName}: let's talk`,
      body: `Hi ${FIRST_NAME},\n\nThank you for applying for the ${roleName} role at Kargo. I read your application and would like to meet.\n\n${schedule}\n\nLooking forward to it.\n\nArjun Mehta\nFounder, Kargo`,
    };
  }
  return {
    kind,
    subject: `Your application for ${roleName} at Kargo`,
    body: `Hi ${FIRST_NAME},\n\nThank you for applying for the ${roleName} role at Kargo and for the time you put into your application. After careful review, we won't be moving forward with your application for this role right now.\n\nI appreciate your interest in what we're building and wish you the very best in your search.\n\nArjun Mehta\nFounder, Kargo`,
  };
}

export async function draftEmail(input: {
  kind: EmailDraft["kind"];
  role: Role;
  strengths: string[];
  schedule: string;
}): Promise<Omit<EmailDraft, "drafted_at">> {
  const roleName = input.role === "PM" ? "Product Manager" : "Senior Product Manager";
  if (!isAiEnabled()) return fallbackEmail(input.kind, input.role, input.schedule);
  const payload = {
    type: input.kind === "invite" ? "INVITE" : "REJECTION",
    role: roleName,
    candidate_strengths: input.strengths,
    scheduling_instruction: input.kind === "invite" ? input.schedule : undefined,
  };
  const res = await model(EMAIL_SYSTEM, 0.4).generateContent(JSON.stringify(payload));
  const parsed = JSON.parse(res.response.text()) as { body?: unknown };
  const fb = fallbackEmail(input.kind, input.role, input.schedule);
  let body = typeof parsed.body === "string" && parsed.body.trim() ? parsed.body.trim() : fb.body;
  // The model sometimes shortens "Senior Product Manager"; the role title must be exact.
  if (input.role === "SPM") body = body.replace(/(?<!Senior )Product Manager/g, "Senior Product Manager");
  if (input.kind === "invite" && input.schedule && !body.includes(input.schedule)) body += `\n\n${input.schedule}`;
  // Subject is fixed text so it always names the right role.
  return { kind: input.kind, subject: fb.subject, body: body.slice(0, 4000) };
}

export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
