import { fail, json, schedulingLine } from "@/lib/api";
import { parseIstLocal } from "@/lib/ics";
import { getStore } from "@/lib/store";
import type { Candidate } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Keep the invite text in step with the slot: swap the old scheduling sentence for the new one. */
function withSchedule(c: Candidate, next: Pick<Candidate, "interview_at" | "interview_minutes" | "interview_mode" | "interview_link">) {
  const d = c.email_draft;
  if (!d || d.kind !== "invite" || c.email_sent_at) return d;
  const line = schedulingLine(next);
  const body = d.schedule_line && d.body.includes(d.schedule_line) ? d.body.replace(d.schedule_line, line) : `${d.body}\n\n${line}`;
  return { ...d, body, schedule_line: line };
}

/** Arjun picks the interview slot (Mumbai time). It then shows up in his calendar feed. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const c = await store.get(params.id);
  if (!c) return fail("Not found", 404);
  if (c.decision !== "advance") return fail("Advance the candidate before booking an interview.", 409);
  const b = (await req.json().catch(() => ({}))) as { at?: unknown; minutes?: unknown; mode?: unknown; link?: unknown };
  const at = typeof b.at === "string" ? parseIstLocal(b.at) : null;
  if (!at) return fail("Pick a date and time.");
  const minutes = typeof b.minutes === "number" && b.minutes >= 15 && b.minutes <= 240 ? Math.round(b.minutes) : 45;
  const mode = b.mode === "video" ? "video" : "in_person";
  const link = mode === "video" && typeof b.link === "string" && /^https?:\/\//.test(b.link.trim()) ? b.link.trim().slice(0, 500) : null;
  const slot = { interview_at: at.toISOString(), interview_minutes: minutes, interview_mode: mode, interview_link: link } as const;
  await store.update(c.id, { ...slot, email_draft: withSchedule(c, slot) });
  return json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const c = await store.get(params.id);
  if (!c) return fail("Not found", 404);
  const slot = { interview_at: null, interview_minutes: null, interview_mode: null, interview_link: null };
  await store.update(c.id, { ...slot, email_draft: withSchedule(c, slot) });
  return json({ ok: true });
}
