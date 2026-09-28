import { CATEGORIES, EXPERIENCE_RANGE, SHORTLIST_MIN_OPS, SHORTLIST_MIN_TOTAL } from "@/lib/rubric";

const ANCHORS: Record<string, [string, string, string]> = {
  ops_ground: ["No ops-heavy industry exposure", "Adjacent ops, or built software for logistics users", "Worked inside freight, CHA, port or 3PL operations"],
  no_layer: ["Always inside a larger team", "Owned a module under a senior lead", "Sole owner, reporting to a founder or CEO"],
  built_missing: ["Ran existing processes only", "Built a tool for self or a small team", "First-of-its-kind system a team adopted"],
  hard_calls: ["Only wins listed", "A clear call with a stated rationale", "Killed or reversed something on data, wrote up why"],
  product_craft: ["No shipping ownership", "Owned features from spec to release", "Owned a roadmap; features used unprompted"],
  crisis: ["No incidents described", "Handled an incident inside a team process", "Personally resolved a live ops crisis"],
  integrations: ["None", "Worked with APIs or integrations", "Owned an integration roadmap or build-vs-configure calls"],
};

export default function RubricPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink">The rubric</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Built from 8 past hires (5 Exceeds vs 3 Meets/Below) and the two JDs. The AI proposes 1–5 per category with a quote; the
          totals, gates and shortlist below are computed in code.
        </p>
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="pb-3 pr-3">#</th>
              <th className="pb-3 pr-3">Category</th>
              <th className="pb-3 pr-3">1</th>
              <th className="pb-3 pr-3">3</th>
              <th className="pb-3 pr-3">5</th>
              <th className="pb-3 pr-3 text-right">PM</th>
              <th className="pb-3 text-right">SPM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {CATEGORIES.map((c) => (
              <tr key={c.id}>
                <td className="py-3 pr-3 font-display text-faint">{c.rank}</td>
                <td className="py-3 pr-3 font-semibold text-ink">{c.label}</td>
                {ANCHORS[c.id].map((t, i) => (
                  <td key={i} className="py-3 pr-3 text-xs text-muted">
                    {t}
                  </td>
                ))}
                <td className="py-3 pr-3 text-right font-display text-brand-700">{c.pm}</td>
                <td className="py-3 text-right font-display text-brand-700">{c.spm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card !p-4">
          <p className="font-semibold text-ink">Gates</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>PM experience: {EXPERIENCE_RANGE.PM.join("–")} yrs (PM), {EXPERIENCE_RANGE.SPM.join("–")} yrs (SPM)</li>
            <li>Mumbai, or willing to relocate · in-office</li>
            <li>Short on years but ops ground = 5 → stretch review, not reject</li>
            <li>CV silent on a gate → unknown, never fail</li>
          </ul>
        </section>
        <section className="card !p-4">
          <p className="font-semibold text-ink">Formula &amp; shortlist</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>total = Σ score × weight ÷ 5 (20–100), for both roles</li>
            <li>
              Shortlist: total ≥ {SHORTLIST_MIN_TOTAL}, ops ground ≥ {SHORTLIST_MIN_OPS}, no failed gate
            </li>
            <li>Tie-break: ops ground, then no layer</li>
            <li>Recommended role = higher total (role switch flagged)</li>
          </ul>
        </section>
        <section className="card !p-4">
          <p className="font-semibold text-ink">Not rewarded</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>College, MBA, certifications (education is stripped before scoring)</li>
            <li>Raw tech-stack match to the spec</li>
            <li>Quantified achievements on their own</li>
            <li>No quote in the CV → score resets to 1</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
