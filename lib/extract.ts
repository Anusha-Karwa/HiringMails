import "server-only";

/** CV file -> plain text with real line breaks. Supports .docx, .pdf, .txt / .md. */

export const ACCEPTED = [".docx", ".pdf", ".txt", ".md"];
export const MAX_BYTES = 5 * 1024 * 1024;

/** Below this many characters a CV is treated as thin/unreadable (rule 4: needs a human read). */
export const THIN_CV_CHARS = 400;

export class UnsupportedFileError extends Error {}

interface PdfItem {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
}

/**
 * Rebuild lines from PDF text items. A plain text dump of a PDF often comes out as one long line,
 * which hides the name / contact line / section headings that redaction relies on. Items are
 * grouped by their baseline (y), sorted left to right, and lines are kept in reading order.
 */
export function pdfItemsToText(pages: PdfItem[][]): string {
  const out: string[] = [];
  for (const items of pages) {
    const rows: { y: number; parts: { x: number; s: string; w: number }[] }[] = [];
    for (const it of items) {
      if (!it.str) continue;
      const x = it.transform?.[4] ?? 0;
      const y = it.transform?.[5] ?? 0;
      const tol = Math.max(2, (it.height ?? 10) * 0.4);
      let row = rows.find((r) => Math.abs(r.y - y) <= tol);
      if (!row) rows.push((row = { y, parts: [] }));
      row.parts.push({ x, s: it.str, w: it.width ?? 0 });
    }
    rows.sort((a, b) => b.y - a.y); // PDF y grows upwards
    for (const r of rows) {
      r.parts.sort((a, b) => a.x - b.x);
      let line = "";
      let end = -Infinity;
      for (const p of r.parts) {
        // Insert a space where there's a visible gap and neither side already has one.
        if (line && p.x - end > 1.5 && !/\s$/.test(line) && !/^\s/.test(p.s)) line += " ";
        line += p.s;
        end = p.x + p.w;
      }
      const t = line.replace(/\s+/g, " ").trim();
      if (t) out.push(t);
    }
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractText(fileName: string, buf: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (ext === ".pdf") {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const pages: PdfItem[][] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items as PdfItem[]);
    }
    return pdfItemsToText(pages);
  }
  if (ext === ".txt" || ext === ".md") return buf.toString("utf8");
  if (ext === ".doc") throw new UnsupportedFileError("Old .doc files aren't supported. Save it as .docx or PDF.");
  throw new UnsupportedFileError(`Unsupported file type "${ext || fileName}". Use ${ACCEPTED.join(", ")}.`);
}
