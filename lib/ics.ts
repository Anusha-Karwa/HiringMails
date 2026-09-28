/**
 * iCalendar (RFC 5545) output. One format covers every calendar Arjun might use:
 *  - a subscribed feed (Google / Outlook / Apple "add calendar from URL") that always lists the
 *    live hiring schedule and reminders
 *  - an invite.ics attached to interview emails, so the slot lands in his and the candidate's calendar
 */

export const TZ = "Asia/Kolkata";

export interface CalEvent {
  uid: string;
  start: Date;
  minutes: number;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  alarmsMinutesBefore?: number[];
  organizer?: { name: string; email: string };
  attendees?: { name: string; email: string }[];
  sequence?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function icsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Fold to 75 octets per line (continuation lines start with a space). */
export function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function eventLines(e: CalEvent, now: Date): string[] {
  const end = new Date(e.start.getTime() + e.minutes * 60_000);
  const l = [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(end)}`,
    `SEQUENCE:${e.sequence ?? 0}`,
    `SUMMARY:${escapeText(e.title)}`,
  ];
  if (e.description) l.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.location) l.push(`LOCATION:${escapeText(e.location)}`);
  if (e.url) l.push(`URL:${e.url}`);
  if (e.organizer) l.push(`ORGANIZER;CN=${escapeText(e.organizer.name)}:mailto:${e.organizer.email}`);
  for (const a of e.attendees ?? []) {
    l.push(`ATTENDEE;CN=${escapeText(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`);
  }
  for (const m of e.alarmsMinutesBefore ?? []) {
    l.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(e.title)}`, `TRIGGER:-PT${m}M`, "END:VALARM");
  }
  l.push("END:VEVENT");
  return l;
}

export function buildCalendar(events: CalEvent[], opts: { name: string; method?: "PUBLISH" | "REQUEST"; now?: Date }): string {
  const now = opts.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kargo//Kargo Hire//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method ?? "PUBLISH"}`,
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    `X-WR-TIMEZONE:${TZ}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap((e) => eventLines(e, now)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** One-click "add to Google Calendar" link (works without any Google setup). */
export function googleCalendarLink(e: Pick<CalEvent, "start" | "minutes" | "title" | "description" | "location">): string {
  const end = new Date(e.start.getTime() + e.minutes * 60_000);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(e.start)}/${icsDate(end)}`,
    details: e.description ?? "",
    location: e.location ?? "",
    ctz: TZ,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** "2026-10-01T15:00" typed in the browser is Mumbai time (IST has no DST, always +05:30). */
export function parseIstLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIstLocalInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
}

export function formatIst(iso: string | Date, withYear = false): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
