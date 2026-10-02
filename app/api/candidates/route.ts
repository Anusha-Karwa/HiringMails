import { ACCEPTED, MAX_BYTES, UnsupportedFileError, extractText } from "@/lib/extract";
import { fail, json } from "@/lib/api";
import { ingest } from "@/lib/pipeline";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const rows = await getStore().list();
  return json({ candidates: rows.map(({ redacted_text: _t, ...rest }) => rest) });
}

/** Trigger: founder uploads one CV + the role applied for. The client sends one file per request. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const entry = form?.get("file");
  const role = form?.get("role");
  // Blob rather than File: File is only a global from Node 20.
  if (!entry || typeof entry === "string" || !(entry instanceof Blob)) return fail("Attach a CV file.");
  const file = entry as Blob & { name?: string };
  const fileName = file.name || "cv.txt";
  if (role !== "PM" && role !== "SPM") return fail("Pick the role applied for: PM or SPM.");
  if (file.size > MAX_BYTES) return fail("That file is over 5 MB.");

  let text: string;
  try {
    text = await extractText(fileName, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof UnsupportedFileError) return fail(e.message);
    return fail(`Couldn't read ${fileName}. Accepted: ${ACCEPTED.join(", ")}.`);
  }
  const { candidate, duplicate } = await ingest(fileName, text, role);
  return json({ id: candidate.id, error: candidate.error, duplicate }, duplicate ? 200 : 201);
}
