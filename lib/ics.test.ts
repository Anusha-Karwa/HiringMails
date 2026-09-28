import { describe, expect, it } from "vitest";
import { hiringEvents, istAt, nextReviewSlot } from "./hiring-calendar";
import { buildCalendar, escapeText, fold, googleCalendarLink, icsDate, parseIstLocal, toIstLocalInput } from "./ics";
import type { Candidate } from "./types";

describe("ics basics", () => {
  it("formats UTC timestamps", () => {
    expect(icsDate(new Date("2026-10-01T09:30:00Z"))).toBe("20261001T093000Z");
  });
  it("escapes text and folds long lines", () => {
    expect(escapeText("a, b; c\nd")).toBe(String.raw`a\, b\; c\nd`);
    const folded = fold("DESCRIPTION:" + "x".repeat(200));
    expect(folded.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "x".repeat(200));
  });
  it("treats typed times as Mumbai time", () => {
    expect(parseIstLocal("2026-10-01T15:00")!.toISOString()).toBe("2026-10-01T09:30:00.000Z");
    expect(toIstLocalInput("2026-10-01T09:30:00.000Z")).toBe("2026-10-01T15:00");
    expect(parseIstLocal("tomorrow")).toBeNull();
  });
  it("builds a valid calendar with alarms", () => {
    const cal = buildCalendar(
      [{ uid: "x@y", start: new Date("2026-10-01T09:30:00Z"), minutes: 45, title: "Interview", alarmsMinutesBefore: [1440, 30] }],
      { name: "Kargo hiring", now: new Date("2026-09-28T00:00:00Z") },
    );
    expect(cal).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(cal).toContain("DTEND:20261001T101500Z");
    expect(cal).toContain("TRIGGER:-PT1440M");
    expect(cal).toContain("TRIGGER:-PT30M");
    expect(cal.trim().endsWith("END:VCALENDAR")).toBe(true);
  });
  it("makes a Google Calendar link", () => {
    const url = googleCalendarLink({ start: new Date("2026-10-01T09:30:00Z"), minutes: 45, title: "Interview: A" });
    expect(url).toContain("dates=20261001T093000Z%2F20261001T101500Z");
  });
});

describe("hiring calendar", () => {
  const base: Candidate = {
    id: "c1", created_at: "2026-09-28T00:00:00Z", file_name: "a.docx", role_applied: "PM", name: "Test Candidate",
    email: "l@example.com", phone: null, location: null, redacted_text: "", removed: [], analysis: null, evaluation: null,
    flags: [], score_runs: 1, error: null, decision: "pending", decided_at: null, email_draft: null, email_sent_at: null,
    email_sent_to: null, interview_at: null, interview_minutes: null, interview_mode: null, interview_link: null,
  };
  const now = new Date("2026-09-28T12:00:00Z"); // Monday 17:30 IST

  it("computes IST wall-clock times and weekday review slots", () => {
    expect(istAt(now, 10, 0, 1).toISOString()).toBe("2026-09-29T04:30:00.000Z");
    expect(nextReviewSlot(now).toISOString()).toBe("2026-09-29T04:00:00.000Z"); // Tue 9:30 IST
    expect(nextReviewSlot(new Date("2026-10-02T12:00:00Z")).toISOString()).toBe("2026-10-05T04:00:00.000Z"); // Fri -> Mon
  });

  it("adds an interview with a next-morning follow-up", () => {
    const c = { ...base, decision: "advance" as const, interview_at: "2026-10-01T09:30:00.000Z", interview_minutes: 45 };
    const ev = hiringEvents([c], "https://x.test", now);
    expect(ev.map((e) => e.uid)).toEqual(["interview-c1@kargo-hire", "followup-c1@kargo-hire"]);
    expect(ev[0].alarmsMinutesBefore).toEqual([1440, 30]);
    expect(ev[1].start.toISOString()).toBe("2026-10-02T04:30:00.000Z");
  });

  it("chases an invite that went out without a slot", () => {
    const c = { ...base, decision: "advance" as const, email_sent_at: "2026-09-28T06:00:00Z" };
    expect(hiringEvents([c], "https://x.test", now)[0].uid).toBe("chase-c1@kargo-hire");
  });

  it("adds a review block only while scored candidates await a call", () => {
    const scored = { ...base, analysis: {} as Candidate["analysis"] };
    expect(hiringEvents([scored], "https://x.test", now)[0].title).toBe("Hiring: 1 awaiting your call");
    expect(hiringEvents([{ ...scored, decision: "pass" }], "https://x.test", now)).toEqual([]);
  });
});
