import { fail, json } from "@/lib/api";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Save the founder's edits to the draft. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const c = await store.get(params.id);
  if (!c?.email_draft) return fail("No draft to edit", 404);
  if (c.email_sent_at) return fail("Already sent", 409);
  const body = (await req.json().catch(() => ({}))) as { subject?: unknown; body?: unknown };
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : c.email_draft.subject;
  const text = typeof body.body === "string" ? body.body.slice(0, 6000) : c.email_draft.body;
  if (!subject || !text.trim()) return fail("Subject and body can't be empty.");
  await store.update(c.id, { email_draft: { ...c.email_draft, subject, body: text } });
  return json({ ok: true });
}
