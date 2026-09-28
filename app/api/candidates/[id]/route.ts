import { fail, json } from "@/lib/api";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const c = await getStore().get(params.id);
  return c ? json({ candidate: c }) : fail("Not found", 404);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await getStore().remove(params.id);
  return json({ ok: true });
}
