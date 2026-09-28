import { baseUrl } from "@/lib/api";
import { calendarToken, safeEqual } from "@/lib/auth";
import { hiringEvents } from "@/lib/hiring-calendar";
import { buildCalendar } from "@/lib/ics";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The hiring calendar feed. Arjun subscribes once (Google: Other calendars → From URL) and his
 * calendar keeps showing every interview, follow-up and review reminder as they change.
 */
export async function GET(req: Request) {
  const expected = await calendarToken();
  const given = new URL(req.url).searchParams.get("token") ?? "";
  if (expected && !safeEqual(given, expected)) return new Response("Not found", { status: 404 });

  const events = hiringEvents(await getStore().list(), baseUrl());
  return new Response(buildCalendar(events, { name: "Kargo hiring" }), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
