import { baseUrl, fail } from "@/lib/api";
import { interviewEvent } from "@/lib/hiring-calendar";
import { buildCalendar } from "@/lib/ics";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** One interview as a .ics file: opens straight into Outlook / Apple Calendar. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const c = await getStore().get(params.id);
  const ev = c && interviewEvent(c, baseUrl());
  if (!ev) return fail("No interview booked", 404);
  return new Response(buildCalendar([ev], { name: "Kargo interview" }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="interview-${(c!.name ?? "candidate").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics"`,
    },
  });
}
