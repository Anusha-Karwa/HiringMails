import Link from "next/link";
import { Score, attentionNote, roleName, status } from "@/components/ui";
import { formatIst } from "@/lib/ics";
import { rankCandidates, type Ranked } from "@/lib/rank";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function greeting(now: Date): string {
  const h = Number(now.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Today({ searchParams }: { searchParams: { role?: string } }) {
  const all = await getStore().list();
  const { ranked, unscored } = rankCandidates(all);
  const role = searchParams.role === "PM" || searchParams.role === "SPM" ? searchParams.role : "all";
  const rows = ranked.filter((c) => role === "all" || c.bestRole === role);
  const shortlist = rows.filter((c) => c.evaluation!.shortlist);
  const others = rows.filter((c) => !c.evaluation!.shortlist);

  const now = new Date();
  const week = now.getTime() + 7 * 86_400_000;
  const upcoming = all
    .filter((c) => c.interview_at && new Date(c.interview_at).getTime() > now.getTime() - 3_600_000)
    .sort((a, b) => a.interview_at!.localeCompare(b.interview_at!));
  const thisWeek = upcoming.filter((c) => new Date(c.interview_at!).getTime() < week).length;
  const needCall = ranked.filter((c) => c.decision === "pending");
  const needCallShort = needCall.filter((c) => c.evaluation!.shortlist).length;

  const summary = !all.length
    ? "Upload the first CVs to get a ranked shortlist."
    : needCall.length
      ? `${needCall.length} candidate${needCall.length > 1 ? "s" : ""} need${needCall.length > 1 ? "" : "s"} your call${needCallShort ? `, ${needCallShort} of them shortlisted` : ""}.`
      : "You're up to date: every candidate has a decision.";

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{greeting(now)}, Arjun</h1>
          <p className="mt-2 text-base text-muted">
            {summary}
            {upcoming[0] && (
              <>
                {" "}
                Next interview: <span className="font-semibold text-ink">{upcoming[0].name}</span>, {formatIst(upcoming[0].interview_at!)}.
              </>
            )}
          </p>
        </div>
        <Link href="/upload" className="btn-primary self-start sm:self-auto">
          Upload CVs
        </Link>
      </section>

      {all.length > 0 && (
        <section className="grid grid-cols-3 gap-3">
          <Stat label="Need your call" value={needCall.length} href="#shortlist" highlight={needCall.length > 0} />
          <Stat label="Shortlisted" value={ranked.filter((c) => c.evaluation!.shortlist).length} href="#shortlist" />
          <Stat label="Interviews this week" value={thisWeek} href="/calendar" />
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="section-title">Coming up</h2>
            <Link href="/calendar" className="link text-sm">
              Calendar
            </Link>
          </div>
          <ul className="card divide-y divide-line !p-0">
            {upcoming.slice(0, 3).map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-brand-50/50">
                  <span className="text-sm">
                    <span className="font-semibold">{formatIst(c.interview_at!)}</span>
                    <span className="text-muted"> · {c.name} · {c.role_applied}</span>
                  </span>
                  <span className="text-xs text-faint">{c.interview_mode === "video" ? "Video" : "In person"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {all.length === 0 ? (
        <Empty />
      ) : (
        <>
          <section id="shortlist" className="scroll-mt-24">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title">Shortlist · {shortlist.length}</h2>
              <RoleFilter active={role} />
            </div>
            {shortlist.length === 0 ? (
              <p className="card text-sm text-muted">Nobody clears the bar yet (score 70+, real logistics ground experience, no failed gate).</p>
            ) : (
              <ol className="space-y-3">
                {shortlist.map((c, i) => (
                  <ShortlistCard key={c.id} c={c} rank={i + 1} />
                ))}
              </ol>
            )}
          </section>

          {others.length > 0 && (
            <section>
              <h2 className="section-title mb-3">Everyone else · {others.length}</h2>
              <ol className="card divide-y divide-line !p-0">
                {others.map((c, i) => {
                  const s = status(c);
                  return (
                    <li key={c.id}>
                      <Link href={`/c/${c.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-brand-50/50">
                        <span className="w-5 text-sm text-faint">{shortlist.length + i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className="font-semibold">{c.name ?? c.file_name}</span>
                          <span className="text-muted"> · {c.role_applied}</span>
                        </span>
                        <span className="w-8 text-right font-display text-lg text-muted">{Math.round(c.best)}</span>
                        <span className={`${s.tone} hidden sm:inline-flex`}>{s.text}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {unscored.length > 0 && (
            <section className="card border-amber-200 bg-amber-50/60">
              <p className="text-sm font-semibold text-amber-900">Not scored yet · {unscored.length}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {unscored.map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-2">
                    <Link href={`/c/${c.id}`} className="link">
                      {c.name ?? c.file_name}
                    </Link>
                    <span className="text-xs text-amber-800">{c.error ?? "Scoring…"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, href, highlight }: { label: string; value: number; href: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`card !p-4 transition hover:shadow-lift sm:!p-5 ${highlight ? "!border-brand-300" : ""}`}>
      <p className="font-display text-3xl font-semibold sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs text-muted sm:text-sm">{label}</p>
    </Link>
  );
}

function ShortlistCard({ c, rank }: { c: Ranked; rank: number }) {
  const s = status(c);
  const note = attentionNote(c);
  return (
    <li>
      <Link href={`/c/${c.id}`} className="card group flex items-start gap-4 transition hover:border-brand-300 hover:shadow-lift">
        <Score value={c.best} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              <span className="mr-2 text-faint">{rank}</span>
              {c.name ?? c.file_name}
            </p>
            <span className={s.tone}>{s.text}</span>
          </div>
          <p className="mt-0.5 text-xs text-faint">
            Applied {c.role_applied}
            {c.bestRole !== c.role_applied && ` · fits ${roleName(c.bestRole)}`}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{c.analysis!.why_ranked_here || c.analysis!.summary}</p>
          {note && <p className="mt-2 text-xs font-medium text-amber-800">{note}</p>}
        </div>
        <span className="hidden self-center text-xl text-faint transition group-hover:translate-x-0.5 group-hover:text-brand-700 sm:block" aria-hidden>
          →
        </span>
      </Link>
    </li>
  );
}

function RoleFilter({ active }: { active: string }) {
  const tabs = [
    { key: "all", label: "All", href: "/" },
    { key: "PM", label: "PM", href: "/?role=PM" },
    { key: "SPM", label: "SPM", href: "/?role=SPM" },
  ];
  return (
    <div className="inline-flex rounded-full border border-line bg-white p-0.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${active === t.key ? "bg-brand-500 text-ink" : "text-muted hover:text-ink"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="card flex flex-col items-center py-14 text-center">
      <h2 className="font-display text-xl font-semibold">No candidates yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Upload CVs and pick the role they applied for. You&apos;ll get a ranked shortlist with a short brief for each person.
      </p>
      <Link href="/upload" className="btn-primary mt-5">
        Upload CVs
      </Link>
    </div>
  );
}
