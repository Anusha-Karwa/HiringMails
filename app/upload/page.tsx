import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Upload CVs</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Pick the role these candidates applied for, then drop one or more CVs. Contact details and education are stripped
          before anything reaches the AI; each CV is then scored against both the PM and SPM rubrics.
        </p>
      </div>
      <UploadForm />
      <ol className="grid gap-2 text-xs text-muted sm:grid-cols-3">
        {[
          ["1", "Extract & redact", "Name, email, phone, links, education and personal details are held back."],
          ["2", "Score both roles", "7 rubric categories, each needs an exact quote from the CV to score above 1."],
          ["3", "Rank & brief", "Totals, gates and the shortlist rule are computed in code, not by the AI."],
        ].map(([n, t, b]) => (
          <li key={n} className="card !p-4">
            <span className="font-display text-lg font-semibold text-brand-700">{n}</span>
            <p className="mt-1 font-semibold text-ink">{t}</p>
            <p className="mt-0.5 leading-relaxed">{b}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
