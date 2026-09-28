import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { interviewLocation } from "./hiring-calendar";
import { formatIst } from "./ics";
import type { Candidate } from "./types";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Public origin of this deployment, for links inside emails and calendar events. */
export function baseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The scheduling sentence of an invite: a concrete slot if Arjun picked one, else ask for times. */
export function schedulingLine(c?: Pick<Candidate, "interview_at" | "interview_minutes" | "interview_mode" | "interview_link">): string {
  if (c?.interview_at) {
    const where = c.interview_mode === "video" ? `on a video call${c.interview_link ? ` (${c.interview_link})` : ""}` : "at our office in Mumbai";
    return `I've set aside ${formatIst(c.interview_at)} IST for ${c.interview_minutes ?? 45} minutes, ${where}. A calendar invite is attached; if that time doesn't work, just reply with two or three alternatives.`;
  }
  const url = process.env.INTERVIEW_BOOKING_URL;
  return url
    ? `I'd like a 45-minute conversation, in person in Mumbai or on a video call. Please pick a time that suits you here: ${url}`
    : "I'd like a 45-minute conversation, in person in Mumbai or on a video call. Could you reply with two or three times over the next week that work for you?";
}

export { interviewLocation };
