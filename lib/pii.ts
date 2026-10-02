/**
 * Split a CV into (a) contact details we keep in the database for emailing, and (b) a redacted
 * text that is the ONLY thing the AI ever sees. The redacted text drops name, email, phone, links,
 * the education section (college and pedigree are excluded signals), personal-detail lines
 * (DOB, age, gender, marital status...) and gendered pronouns, so scoring is blind by construction.
 */

export interface ContactDetails {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
}

export interface Prepared {
  contact: ContactDetails;
  redacted: string;
  removed: string[]; // what was stripped, shown to the founder for transparency
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)\d{3,5}[\s-]?\d{3,5}/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|medium\.com)\/\S*/gi;
const PERSONAL_LINE_RE =
  /^\s*(date of birth|dob|d\.o\.b|age|gender|sex|marital status|nationality|religion|caste|father'?s name|mother'?s name|passport|aadhaar|pan)\b.*$/gim;

const SECTION_WORDS =
  "summary|professional summary|profile|professional profile|about( me)?|objective|career objective|experience|work experience|professional experience|employment( history)?|education|academic( background| qualifications)?|qualifications|certifications?( ?(&|and) ?tools)?|skills|technical skills|tools|projects|achievements|awards|interests|hobbies|languages|personal (details|information)|volunteering|publications|references";
const HEADING_RE = new RegExp(`^\\s*(${SECTION_WORDS})\\s*:?\\s*$`, "i");
const DROP_SECTION_RE = /^(education|academic|qualifications|personal (details|information)|references|hobbies|interests)/i;

const PRONOUNS: [RegExp, string][] = [
  [/\b(he|she)\b/gi, "they"],
  [/\b(him)\b/gi, "them"],
  [/\b(his|her)\b/gi, "their"],
  [/\b(hers)\b/gi, "theirs"],
  [/\b(himself|herself)\b/gi, "themselves"],
  [/\b(mr|mrs|ms|miss)\.?\s+/gi, ""],
];

const clean = (s: string) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();

function looksLikeName(line: string): boolean {
  const l = clean(line);
  if (!l || l.length > 60 || /\d|@|\|/.test(l) || HEADING_RE.test(l)) return false;
  const words = l.split(/\s+/);
  return words.length >= 1 && words.length <= 5 && words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());

/** "17_pranav_joshi.pdf" -> "Pranav Joshi": a fallback when the CV has no clean name line. */
export function nameFromFileName(fileName?: string): string | null {
  if (!fileName) return null;
  const words = fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[\s_.-]+/)
    .filter((w) => /^[a-z]+$/i.test(w) && !/^(cv|resume|final|updated|new|copy|pm|spm|apm)$/i.test(w));
  return words.length >= 2 && words.length <= 4 ? titleCase(words.join(" ")) : null;
}

const LABEL_RE = /\b(email|e-mail|mobile|phone|tel|portfolio|linkedin|github|website|address)\s*:?/gi;

// Indian mobile, optionally +91: "+91 98142 60317", "9814260317". Tried before the generic pattern,
// which over-matches when a PDF repeats the digits.
const INDIAN_MOBILE_RE = /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/;

/** "Rohan BasuROHAN BASU" -> "Rohan Basu" (some PDFs store the name twice, e.g. a visible and a hidden copy). */
export function undouble(s: string): string {
  const t = s.trim();
  const key = (x: string) => x.toLowerCase().replace(/\s+/g, "");
  for (let i = Math.floor(t.length / 2) - 2; i <= Math.ceil(t.length / 2) + 2; i++) {
    if (i <= 0 || i >= t.length) continue;
    const a = t.slice(0, i);
    const b = t.slice(i);
    if (key(a).length >= 3 && key(a) === key(b)) return a.trim();
  }
  return t;
}

export function prepareCv(raw: string, fileName?: string): Prepared {
  const removed: string[] = [];
  const lines = raw.replace(/\r/g, "").split("\n").map((l) => l.replace(/ /g, " "));

  // Header = everything before the first section heading (usually name + contact line).
  let firstHeading = lines.findIndex((l) => HEADING_RE.test(l));
  if (firstHeading === -1 || firstHeading > 12) firstHeading = Math.min(4, lines.length);
  const header = lines.slice(0, firstHeading).map(clean).filter(Boolean);
  const body = lines.slice(firstHeading);

  const headerText = header.join("\n");
  const email = (headerText.match(EMAIL_RE) ?? raw.match(EMAIL_RE))?.[0] ?? null;
  const phone =
    headerText.match(INDIAN_MOBILE_RE)?.[0].trim() ??
    (headerText.match(PHONE_RE) ?? []).map((p) => p.trim()).find((p) => p.replace(/\D/g, "").length >= 10) ??
    null;

  // The name is usually the first thing in the header, sometimes sharing a line with "Email: ...".
  // Some PDFs also carry it twice ("Rohan BasuROHAN BASU"), so take one copy.
  const headerNames = header.map((h) => undouble(h.split(/\b(?:email|e-mail|mobile|phone|portfolio|linkedin)\b|@|\||\+?\d{5}/i)[0].trim()));
  const nameLine = headerNames.find(looksLikeName) ?? null;
  const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

  // Whatever is left on the contact line after removing name/email/phone/links is the location.
  let location: string | null = null;
  for (const h of header) {
    if (nameLine && nameKey(undouble(h)) === nameKey(nameLine)) continue;
    const rest = h
      .replace(nameLine ? new RegExp(escapeRe(nameLine), "gi") : /$^/, "")
      .replace(INDIAN_MOBILE_RE, "")
      .replace(EMAIL_RE, "")
      .replace(URL_RE, "")
      .replace(PHONE_RE, "")
      .replace(LABEL_RE, "")
      .split(/\s*[|·•,]\s*|\s{2,}/)
      .map((p) => p.trim())
      .filter((p) => p && /[a-z]/i.test(p) && !/^[+\d\s()/-]+$/.test(p))
      .filter((p) => !nameLine || !nameKey(p).includes(nameKey(nameLine.split(/\s+/)[0])));
    const found = rest.join(", ");
    // A real location is short ("Mumbai, Maharashtra"); anything longer is body text that leaked in.
    if (rest.length && found.length <= 60 && found.split(/\s+/).length <= 8) {
      location = found;
      break;
    }
  }

  const fileNameGuess = nameFromFileName(fileName);
  const displayName = nameLine ? (nameLine === nameLine.toUpperCase() ? titleCase(nameLine) : nameLine) : fileNameGuess;
  const contact: ContactDetails = { name: displayName, email, phone, location };
  if (displayName) removed.push("name");
  if (email) removed.push("email");
  if (phone) removed.push("phone");

  // Drop whole sections that carry pedigree or personal details.
  const kept: string[] = [];
  let dropping = false;
  for (const line of body) {
    const t = clean(line);
    if (HEADING_RE.test(t)) {
      dropping = DROP_SECTION_RE.test(t);
      if (dropping) removed.push(`${t.toLowerCase()} section`);
    }
    if (!dropping) kept.push(line);
  }

  let text = kept.join("\n");
  if (text.match(URL_RE)) removed.push("links");
  text = text.replace(EMAIL_RE, "[email]").replace(URL_RE, "[link]");
  text = text.replace(PHONE_RE, (m) => (m.replace(/\D/g, "").length >= 10 ? "[phone]" : m));
  if (text.match(PERSONAL_LINE_RE)) removed.push("personal details");
  text = text.replace(PERSONAL_LINE_RE, "");

  // The candidate's own name anywhere in the body (e.g. quoted in a review note).
  // Name parts come from the name line and the file name, so a name glued to other text in a PDF
  // ("Pranav JoshiPRANAV JOSHI") is still caught. Parts of 4+ letters match without word boundaries.
  const parts = new Set(
    [nameLine, fileNameGuess]
      .filter((n): n is string => Boolean(n))
      .flatMap((n) => n.split(/\s+/))
      .filter((p) => p.length >= 3)
      .map((p) => p.toLowerCase()),
  );
  for (const part of Array.from(parts).sort((a, b) => b.length - a.length)) {
    const re = part.length >= 4 ? new RegExp(escapeRe(part), "gi") : new RegExp(`\\b${escapeRe(part)}\\b`, "gi");
    text = text.replace(re, " the candidate ");
  }
  text = text.replace(/(?:\s*the candidate\s*){2,}/g, " the candidate ").replace(/[ \t]{2,}/g, " ");
  for (const [re, to] of PRONOUNS) text = text.replace(re, to);

  const locationLine = location ? `Location (from CV header): ${location}\n\n` : "";
  const redacted = (locationLine + text)
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { contact, redacted, removed: Array.from(new Set(removed)) };
}

/** Normalise for quote matching: case, whitespace, quote marks and dashes don't matter. */
export function normaliseForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛`]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rule 1 "no quote, no score": the evidence must appear in the CV text the AI was given.
 * Quotes may skip words with "..." — every fragment of 12+ chars must then be present.
 */
export function quoteIsInText(quote: string, text: string): boolean {
  const hay = normaliseForMatch(text);
  const frags = normaliseForMatch(quote)
    .replace(/^["'\s-]+|["'\s.]+$/g, "")
    .split(/\.{3}|…/)
    .map((f) => f.trim().replace(/^["'\s-]+|["'\s-]+$/g, ""))
    .filter((f) => f.length >= 12);
  return frags.length > 0 && frags.every((f) => hay.includes(f));
}
