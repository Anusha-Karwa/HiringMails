import "server-only";
import { FIRST_NAME } from "./gemini";

/** Output: send through Resend (https://resend.com/docs/api-reference/emails/send-email). */

export const isEmailEnabled = () => Boolean(process.env.RESEND_API_KEY);

/**
 * While testing, set EMAIL_TEST_RECIPIENT so every email goes to you instead of the candidate.
 * (Resend's shared onboarding@resend.dev sender can only deliver to your own account email anyway.)
 */
export function recipientFor(candidateEmail: string | null): string | null {
  return process.env.EMAIL_TEST_RECIPIENT || candidateEmail;
}

export function firstName(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : "there";
}

export const personalise = (text: string, name: string | null) => text.split(FIRST_NAME).join(firstName(name));

export interface Attachment {
  filename: string;
  content: string; // plain text, base64-encoded before sending
  contentType?: string;
}

export async function sendEmail(to: string, subject: string, text: string, attachments: Attachment[] = []): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = process.env.RESEND_FROM || "Kargo Hiring <onboarding@resend.dev>";
  const replyTo = process.env.RESEND_REPLY_TO;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachments.length
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: Buffer.from(a.content, "utf8").toString("base64"),
              ...(a.contentType ? { content_type: a.contentType } : {}),
            })),
          }
        : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) throw new Error(`Resend: ${data.message ?? res.statusText}`);
  return { id: data.id };
}

/** Arjun's own address: gets a calendar copy of every interview. In test mode it's the test inbox. */
export function founderEmail(): string | null {
  return process.env.EMAIL_TEST_RECIPIENT || process.env.FOUNDER_EMAIL || process.env.RESEND_REPLY_TO || null;
}
