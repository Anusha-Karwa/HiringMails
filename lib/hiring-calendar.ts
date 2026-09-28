import { CATEGORIES } from "./rubric";
import { formatIst, type CalEvent } from "./ics";
import type { Candidate } from "./types";

/**
 * Everything in the hiring process that should sit in Arjun's calendar:
 *   - interviews (reminders 1 day and 30 min before, brief + probe questions in the notes)
 *   - a follow-up the morning after each interview, so the decision doesn't stall
 *   - a chase reminder if an invite went out without a slot and nothing is booked 3 days later
 *   - a short daily review block while candidates are waiting for his call
 */

const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;

/** The instant that is hh:mm IST on the IST calendar day of `d`, plus `addDays`. */
export function istAt(d: Date, hh: number, mm: number, addDays = 0): Date {
  const ist = new Date(d.getTime() + IST_OFFSET);
  const utc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + addDays, hh, mm) - IST_OFFSET;
  return new Date(utc);
}

/** Next weekday at 9:30 IST that is still ahead of `now`. */
export function nextReviewSlot(now: Date): Date {
  for (let i = 0; i < 8; i++) {
    const slot = istAt(now, 9, 30, i);
    const dow = new Date(slot.getTime() + IST_OFFSET).getUTCDay();
    if (slot > now && dow !== 0 && dow !== 6) return slot;
  }
  return istAt(now, 9, 30, 1);
}

export const interviewLocation = (c: Pick<Candidate, "interview_mode" | "interview_link">) =>
  c.interview_mode === "video" ? c.interview_link || "Video call" : "Kargo office, Mumbai";

export function interviewDescription(c: Candidate, baseUrl: string): string {
  const e = c.evaluation;
  const a = c.analysis;
  const lines = [`${c.role_applied === "PM" ? "Product Manager" : "Senior Product Manager"} interview`];
  if (e) lines.push(`Score: PM ${Math.round(e.total_pm)} · SPM ${Math.round(e.total_spm)}${e.shortlist ? " · shortlisted" : ""}`);
  if (a?.why_ranked_here) lines.push("", `Why ranked here: ${a.why_ranked_here}`);
  if (a?.probe_questions.length) {
    lines.push("", "Ask about:");
    a.probe_questions.forEach((p, i) => {
      const cat = CATEGORIES.find((x) => x.id === p.category)?.short;
      lines.push(`${i + 1}. ${p.question}${cat ? ` (${cat})` : ""}`);
    });
  }
  if (c.interview_mode === "video" && c.interview_link) lines.push("", `Join: ${c.interview_link}`);
  lines.push("", `Full brief: ${baseUrl}/c/${c.id}`);
  return lines.join("\n");
}

export function interviewEvent(c: Candidate, baseUrl: string): CalEvent | null {
  if (!c.interview_at) return null;
  return {
    uid: `interview-${c.id}@kargo-hire`,
    start: new Date(c.interview_at),
    minutes: c.interview_minutes ?? 45,
    title: `Interview: ${c.name ?? "Candidate"} (${c.role_applied})`,
    description: interviewDescription(c, baseUrl),
    location: interviewLocation(c),
    url: `${baseUrl}/c/${c.id}`,
    alarmsMinutesBefore: [1440, 30],
  };
}

export function hiringEvents(candidates: Candidate[], baseUrl: string, now = new Date()): CalEvent[] {
  const events: CalEvent[] = [];
  const horizon = now.getTime() - 30 * DAY; // keep a month of history visible

  for (const c of candidates) {
    const name = c.name ?? "candidate";
    const iv = interviewEvent(c, baseUrl);
    if (iv && iv.start.getTime() > horizon) {
      events.push(iv);
      events.push({
        uid: `followup-${c.id}@kargo-hire`,
        start: istAt(iv.start, 10, 0, 1),
        minutes: 15,
        title: `Decide on ${name} after yesterday's interview`,
        description: `Record the outcome and send the next email from the dashboard.\n${baseUrl}/c/${c.id}`,
        url: `${baseUrl}/c/${c.id}`,
        alarmsMinutesBefore: [0],
      });
    } else if (!iv && c.decision === "advance" && c.email_sent_at) {
      const chase = istAt(new Date(c.email_sent_at), 10, 0, 3);
      if (chase.getTime() > horizon) {
        events.push({
          uid: `chase-${c.id}@kargo-hire`,
          start: chase,
          minutes: 15,
          title: `Chase ${name}: interview not booked yet`,
          description: `Invite sent ${formatIst(c.email_sent_at)}. Add a slot on the dashboard once they reply.\n${baseUrl}/c/${c.id}`,
          url: `${baseUrl}/c/${c.id}`,
          alarmsMinutesBefore: [0],
        });
      }
    }
  }

  const pending = candidates.filter((c) => c.decision === "pending" && c.analysis);
  if (pending.length) {
    const short = pending.filter((c) => c.evaluation?.shortlist);
    const slot = nextReviewSlot(now);
    const names = [...short, ...pending.filter((c) => !c.evaluation?.shortlist)].slice(0, 8).map((c) => `• ${c.name ?? c.file_name}`);
    events.push({
      uid: `review-${slot.toISOString().slice(0, 10)}@kargo-hire`,
      start: slot,
      minutes: 20,
      title: `Hiring: ${pending.length} awaiting your call${short.length ? ` (${short.length} shortlisted)` : ""}`,
      description: [`Advance or Pass, then Send. Everything else is automatic.`, "", ...names, "", baseUrl].join("\n"),
      url: baseUrl,
      alarmsMinutesBefore: [10],
    });
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}
