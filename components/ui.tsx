import { SHORTLIST_MIN_TOTAL, type Role } from "@/lib/rubric";
import type { Candidate } from "@/lib/types";

export const roleName = (r: Role) => (r === "PM" ? "Product Manager" : "Senior Product Manager");

/** A plain number in a soft tile: aqua at/above the shortlist bar, grey below. */
export function Score({ value, size = "md" }: { value: number | null; size?: "md" | "lg" }) {
  const v = value === null ? null : Math.round(value);
  const good = v !== null && v >= SHORTLIST_MIN_TOTAL;
  const dims = size === "lg" ? "h-20 w-20 text-4xl rounded-2xl" : "h-12 w-12 text-xl rounded-xl";
  return (
    <span
      className={`grid shrink-0 place-items-center font-display font-semibold ${dims} ${
        good ? "bg-brand-500 text-ink" : "bg-gray-100 text-muted"
      }`}
      title={v === null ? "Not scored" : `${v} / 100`}
    >
      {v ?? "–"}
    </span>
  );
}

export function ScoreDots({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-4 rounded-full ${i <= score ? (score >= 4 ? "bg-brand-500" : score === 3 ? "bg-brand-300" : "bg-amber-300") : "bg-gray-200"}`} />
      ))}
    </span>
  );
}

/** One short plain-English note if something needs a human look, else null. */
export function attentionNote(c: Candidate): string | null {
  const f = c.flags;
  if (f.includes("needs_human_read")) return "Thin or hard-to-read CV: worth reading yourself.";
  if (f.includes("stretch_review")) return "Short on PM years but strong on the ground: a stretch candidate.";
  if (f.some((x) => x.startsWith("inconsistent"))) return "Scores moved between runs: check the evidence.";
  if (f.includes("role_switch") && c.evaluation) return `Scores higher for ${roleName(c.evaluation.recommended_role)} than the role applied for.`;
  if (c.evaluation?.gates.location === "fail" || c.evaluation?.gates.work_mode === "fail") return "Says they won't relocate or work in-office.";
  return null;
}

export function status(c: Pick<Candidate, "decision" | "email_sent_at" | "interview_at">): { text: string; tone: string } {
  if (c.decision === "advance" && c.interview_at) return { text: "Interview booked", tone: "chip-aqua" };
  if (c.email_sent_at) return { text: c.decision === "advance" ? "Invite sent" : "Rejection sent", tone: "chip-muted" };
  if (c.decision === "advance") return { text: "Advance · send invite", tone: "chip-aqua" };
  if (c.decision === "pass") return { text: "Pass · send email", tone: "chip-amber" };
  return { text: "Needs your call", tone: "chip-amber" };
}

export function flagText(f: string): string {
  if (f === "role_switch") return "role switch";
  if (f === "needs_human_read") return "needs human read";
  if (f === "stretch_review") return "stretch review";
  if (f.startsWith("above_")) return `above ${f.split("_")[1]} range`;
  return f.replace(/_/g, " ");
}

export const gateText = (g: string) => (g === "pass" ? "✓" : g === "fail" ? "✗" : g === "stretch_review" ? "stretch" : "?");
