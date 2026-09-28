import { baseUrl, fail, json } from "@/lib/api";
import { founderEmail, isEmailEnabled, personalise, recipientFor, sendEmail, type Attachment } from "@/lib/email";
import { interviewEvent } from "@/lib/hiring-calendar";
import { buildCalendar, formatIst } from "@/lib/ics";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * One-click send via Resend, only when the founder clicks Send. An invite with a booked slot
 * carries a calendar invite, and Arjun gets his own copy with the brief in the event notes.
 */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const c = await store.get(params.id);
  if (!c) return fail("Not found", 404);
  if (c.decision === "pending" || !c.email_draft) return fail("Decide Advance or Pass first.", 409);
  if (c.email_sent_at) return fail("Already sent.", 409);
  if (!isEmailEnabled()) return fail("RESEND_API_KEY is not set, so emails can't be sent yet.", 503);
  const to = recipientFor(c.email);
  if (!to) return fail("No email address was found on this CV.", 422);

  const origin = baseUrl();
  const ev = c.email_draft.kind === "invite" ? interviewEvent(c, origin) : null;
  const founder = founderEmail();
  const organizer = founder ? { name: "Arjun Mehta (Kargo)", email: founder } : undefined;
  const attachments: Attachment[] = [];
  if (ev) {
    // The candidate's copy has no internal brief, just the slot.
    const candidateEvent = {
      ...ev,
      title: `Kargo ${c.role_applied === "PM" ? "Product Manager" : "Senior Product Manager"} conversation`,
      description: `Conversation with Arjun Mehta, founder of Kargo.${c.interview_link ? `\nJoin: ${c.interview_link}` : ""}`,
      url: undefined,
      organizer,
      attendees: [{ name: c.name ?? "Candidate", email: to }],
      alarmsMinutesBefore: [60],
    };
    attachments.push({ filename: "invite.ics", content: buildCalendar([candidateEvent], { name: "Kargo interview", method: "REQUEST" }), contentType: "text/calendar; method=REQUEST" });
  }

  try {
    await sendEmail(to, personalise(c.email_draft.subject, c.name), personalise(c.email_draft.body, c.name), attachments);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 502);
  }
  await store.update(c.id, { email_sent_at: new Date().toISOString(), email_sent_to: to });

  // Arjun's calendar copy. A failure here must not undo the candidate email.
  let founderCopy: string | null = null;
  if (ev && founder) {
    try {
      await sendEmail(
        founder,
        `Interview booked: ${c.name ?? "candidate"} · ${formatIst(ev.start)}`,
        `${c.name ?? "The candidate"} has been sent an invite for ${formatIst(ev.start)} IST.\n\nOpen the attached invite to add it to your calendar (it is also in your Kargo hiring calendar feed).\n\n${ev.description ?? ""}`,
        [{ filename: "interview.ics", content: buildCalendar([{ ...ev, organizer, attendees: [{ name: "Arjun Mehta", email: founder }] }], { name: "Kargo interview", method: "REQUEST" }), contentType: "text/calendar; method=REQUEST" }],
      );
      founderCopy = founder;
    } catch {
      founderCopy = null;
    }
  }
  return json({ ok: true, to, founderCopy });
}
