import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { baseUrl } from "@/lib/api";
import { calendarToken } from "@/lib/auth";
import { hiringEvents } from "@/lib/hiring-calendar";
import { TZ } from "@/lib/ics";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const time = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });

export default async function CalendarPage() {
  const origin = baseUrl();
  const token = await calendarToken();
  const feed = `${origin}/api/calendar${token ? `?token=${token}` : ""}`;
  const webcal = feed.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const local = /localhost|127\.0\.0\.1/.test(origin);

  const now = new Date();
  const events = hiringEvents(await getStore().list(), origin, now).filter((e) => e.start.getTime() > now.getTime() - 3_600_000);
  const days = new Map<string, typeof events>();
  for (const e of events) days.set(dayKey(e.start), [...(days.get(dayKey(e.start)) ?? []), e]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Hiring calendar</h1>
        <p className="mt-2 max-w-2xl text-base text-muted">
          Add this once and your calendar keeps itself up to date: interviews with the brief in the notes, a nudge the morning after
          each one, a chase if a candidate hasn&apos;t booked, and a short daily review while people are waiting on you.
        </p>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Add to your calendar</h2>
        <div className="flex flex-wrap gap-2">
          <a href={google} target="_blank" rel="noreferrer" className="btn-primary">
            Add to Google Calendar
          </a>
          <a href={webcal} className="btn-secondary">
            Apple / Outlook
          </a>
          <CopyButton text={feed} label="Copy feed link" />
        </div>
        <p className="text-xs leading-relaxed text-faint">
          Google refreshes subscribed calendars every few hours, so each interview invite also emails you a calendar copy that appears
          straight away.
          {token ? " The link contains a private key: don't share it." : ""}
          {local ? " This is a local address: calendar apps can only subscribe once the dashboard is deployed." : ""}
        </p>
      </section>

      <section>
        <h2 className="section-title mb-3">What&apos;s in it</h2>
        {events.length === 0 ? (
          <p className="card text-sm text-muted">
            Nothing scheduled yet. Advance a candidate and book a slot, and it will show up here and in your calendar.
          </p>
        ) : (
          <div className="space-y-5">
            {Array.from(days.entries()).map(([k, list]) => (
              <div key={k}>
                <p className="mb-2 text-sm font-semibold">{dayLabel(list[0].start)}</p>
                <ul className="card divide-y divide-line !p-0">
                  {list.map((e) => {
                    const interview = e.uid.startsWith("interview-");
                    return (
                      <li key={e.uid} className="flex items-start gap-4 px-5 py-3.5">
                        <span className="w-20 shrink-0 pt-0.5 text-sm text-muted">{time(e.start)}</span>
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${interview ? "bg-brand-500" : "bg-amber-400"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{e.title}</span>
                          <span className="block text-xs text-faint">
                            {e.minutes} min{e.location ? ` · ${e.location}` : ""} · reminder{" "}
                            {e.alarmsMinutesBefore?.map((m) => (m >= 1440 ? "1 day" : m === 0 ? "at start" : `${m} min`)).join(" + ")} before
                          </span>
                        </span>
                        {e.url && (
                          <Link href={e.url.replace(origin, "") || "/"} className="link shrink-0 text-sm">
                            Open
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
