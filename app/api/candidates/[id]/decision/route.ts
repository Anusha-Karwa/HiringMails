import { fail, json, schedulingLine } from "@/lib/api";
import { draftEmail } from "@/lib/gemini";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Arjun decides. Only after an Advance / Pass click does the AI draft the email (rule 8: never
 * draft or send based on score alone). Nothing is sent until he clicks Send.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const c = await store.get(params.id);
  if (!c) return fail("Not found", 404);
  const body = (await req.json().catch(() => ({}))) as { decision?: unknown };
  const decision = body.decision;
  if (decision !== "advance" && decision !== "pass" && decision !== "pending") return fail("Unknown decision");
  if (c.email_sent_at) return fail("The email for this candidate has already been sent.", 409);

  if (decision === "pending") {
    await store.update(c.id, { decision, decided_at: null, email_draft: null });
    return json({ ok: true });
  }
  const schedule = schedulingLine(c);
  let draft;
  try {
    draft = await draftEmail({
      kind: decision === "advance" ? "invite" : "rejection",
      // Keep the role they applied for in the email; a role switch is a conversation, not a surprise.
      role: c.role_applied,
      strengths: c.analysis?.strengths ?? [],
      schedule,
    });
  } catch (e) {
    return fail(`Couldn't draft the email: ${e instanceof Error ? e.message : e}`, 502);
  }
  await store.update(c.id, {
    decision,
    decided_at: new Date().toISOString(),
    email_draft: {
      ...draft,
      drafted_at: new Date().toISOString(),
      schedule_line: draft.kind === "invite" ? schedule : undefined,
    },
  });
  return json({ ok: true });
}
