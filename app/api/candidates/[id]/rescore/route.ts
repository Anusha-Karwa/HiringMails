import { fail, json } from "@/lib/api";
import { score } from "@/lib/pipeline";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Run the same prompt again. Categories that move by 2+ get an "inconsistent" flag (rule 7). */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const c = await getStore().get(params.id);
  if (!c) return fail("Not found", 404);
  const next = await score(c);
  return next.error ? fail(next.error, 502) : json({ ok: true });
}
