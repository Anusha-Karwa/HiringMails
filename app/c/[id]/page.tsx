import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateActions } from "@/components/CandidateActions";
import { DecisionPanel } from "@/components/DecisionPanel";
import { Score, ScoreDots, attentionNote, flagText, gateText, roleName } from "@/components/ui";
import { baseUrl } from "@/lib/api";
import { founderEmail, isEmailEnabled, recipientFor } from "@/lib/email";
import { interviewEvent } from "@/lib/hiring-calendar";
import { googleCalendarLink, toIstLocalInput } from "@/lib/ics";
import { rankCandidates } from "@/lib/rank";
import { CATEGORIES, EXPERIENCE_RANGE } from "@/lib/rubric";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CandidatePage({ params }: { params: { id: string } }) {
  const store = getStore();
  const c = await store.get(params.id);
  if (!c) notFound();

  const { ranked } = rankCandidates(await store.list());
  const position = ranked.findIndex((r) => r.id === c.id);
  const a = c.analysis;
  const e = c.evaluation;
  const best = e ? (e.recommended_role === "PM" ? e.total_pm : e.total_spm) : null;
  const note = attentionNote(c);
  const ev = interviewEvent(c, baseUrl());

  const verdict = !e
    ? "Not scored yet."
    : e.shortlist
      ? "Shortlisted: looks like your Exceeds hires."
      : e.gates.experience === "fail" || e.gates.location === "fail"
        ? "Below the bar: fails a hard requirement."
        : "Below the shortlist bar.";

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Back
      </Link>

      <section className="card flex flex-col gap-5 sm:flex-row sm:items-center">
        <Score value={best} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold">{c.name ?? "Name not found"}</h1>
          <p className="mt-1 text-sm text-muted">
            Applied for {roleName(c.role_applied)}
            {position >= 0 && ` · #${position + 1} of ${ranked.length}`}
            {e && ` · PM ${Math.round(e.total_pm)} / SPM ${Math.round(e.total_spm)}`}
          </p>
          <p className={`mt-2 text-sm font-semibold ${e?.shortlist ? "text-brand-800" : "text-ink"}`}>{verdict}</p>
          {note && <p className="mt-1 text-sm text-amber-800">{note}</p>}
        </div>
      </section>

      {c.error && <p className="card border-red-200 bg-red-50 text-sm text-red-700">{c.error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {a && (
            <section className="card space-y-6">
              <div>
                <h2 className="section-title">In 30 seconds</h2>
                <p className="mt-2 text-[15px] leading-relaxed">{a.why_ranked_here || a.summary}</p>
                {a.strengths.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    {a.strengths.map((s) => (
                      <li key={s} className="flex gap-2">
                        <span className="text-brand-600">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {a.probe_questions.length > 0 && (
                <div>
                  <h2 className="section-title">Ask in the interview</h2>
                  <ol className="mt-2 space-y-3">
                    {a.probe_questions.map((p, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed">
                        <span className="font-display text-lg font-semibold leading-6 text-brand-600">{i + 1}</span>
                        <span>{p.question}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          )}

          {a && e && (
            <details className="card group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                <span>See the evidence behind the score</span>
                <span className="text-faint transition group-open:rotate-90">›</span>
              </summary>
              <p className="mt-3 text-xs text-faint">
                Every score above 1 is backed by a line quoted from the CV. Weights shown PM / SPM.
              </p>
              <p className="mt-3 text-sm text-muted">
                Experience {gateText(e.gates.experience)} ({a.pm_years ?? "?"} PM yrs, needs {EXPERIENCE_RANGE[e.recommended_role].join("–")}) ·
                Mumbai {gateText(e.gates.location)} · In-office {gateText(e.gates.work_mode)}
              </p>
              <ul className="mt-4 divide-y divide-line">
                {CATEGORIES.map((cat) => {
                  const s = a.scores[cat.id];
                  const unverified = a.unverified.includes(cat.id);
                  return (
                    <li key={cat.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{cat.label}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-faint">
                            {cat.pm}/{cat.spm}
                          </span>
                          <ScoreDots score={s.score} />
                        </span>
                      </div>
                      {s.evidence && (
                        <p className={`mt-1.5 text-[13px] italic leading-relaxed ${unverified ? "text-red-600 line-through" : "text-muted"}`}>
                          “{s.evidence}”
                        </p>
                      )}
                      {unverified && <p className="mt-1 text-xs text-red-600">Quote not found in the CV, so scored 1.</p>}
                    </li>
                  );
                })}
              </ul>
              {c.flags.length > 0 && <p className="mt-3 text-xs text-faint">Flags: {c.flags.map(flagText).join(" · ")}</p>}
            </details>
          )}

          <details className="card group">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
              <span>What the AI saw</span>
              <span className="text-faint transition group-open:rotate-90">›</span>
            </summary>
            <p className="mt-3 text-xs text-faint">Held back: {c.removed.length ? c.removed.join(", ") : "nothing detected"}.</p>
            <pre className="mt-3 max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-4 font-sans text-[13px] leading-relaxed text-muted">
              {c.redacted_text}
            </pre>
          </details>

          <p className="text-xs text-faint">
            {c.email ?? "No email found"}
            {c.phone && ` · ${c.phone}`}
            {c.location && ` · ${c.location}`} · {c.file_name}
          </p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <DecisionPanel
            id={c.id}
            decision={c.decision}
            draft={c.email_draft}
            sentAt={c.email_sent_at}
            sentTo={c.email_sent_to}
            recipient={recipientFor(c.email)}
            founderCopyTo={founderEmail()}
            isTestRecipient={Boolean(process.env.EMAIL_TEST_RECIPIENT)}
            emailEnabled={isEmailEnabled()}
            firstName={c.name?.split(/\s+/)[0] ?? "there"}
            slot={
              c.interview_at
                ? {
                    local: toIstLocalInput(c.interview_at),
                    minutes: c.interview_minutes ?? 45,
                    mode: c.interview_mode ?? "in_person",
                    link: c.interview_link ?? "",
                    google: ev ? googleCalendarLink(ev) : "",
                  }
                : null
            }
          />
          <CandidateActions id={c.id} runs={c.score_runs} />
        </aside>
      </div>
    </div>
  );
}
