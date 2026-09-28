import "server-only";

/** CV file -> plain text. Supports .docx, .pdf, .txt / .md. */

export const ACCEPTED = [".docx", ".pdf", ".txt", ".md"];
export const MAX_BYTES = 5 * 1024 * 1024;

/** Below this many characters a CV is treated as thin/unreadable (rule 4: needs a human read). */
export const THIN_CV_CHARS = 400;

export class UnsupportedFileError extends Error {}

export async function extractText(fileName: string, buf: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (ext === ".pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (ext === ".txt" || ext === ".md") return buf.toString("utf8");
  if (ext === ".doc") throw new UnsupportedFileError("Old .doc files aren't supported. Save it as .docx or PDF.");
  throw new UnsupportedFileError(`Unsupported file type "${ext || fileName}". Use ${ACCEPTED.join(", ")}.`);
}
