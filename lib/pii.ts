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

export function prepareCv(raw: string): Prepared {
  const removed: string[] = [];
  const lines = raw.replace(/\r/g, "").split("\n").map((l) => l.replace(/ /g, " "));

  // Header = everything before the first section heading (usually name + contact line).
  let firstHeading = lines.findIndex((l) => HEADING_RE.test(l));
  if (firstHeading === -1 || firstHeading > 12) firstHeading = Math.min(4, lines.length);
  const header = lines.slice(0, firstHeading).map(clean).filter(Boolean);
  const body = lines.slice(firstHeading);

  const headerText = header.join("\n");
  const email = (headerText.match(EMAIL_RE) ?? raw.match(EMAIL_RE))?.[0] ?? null;
  const phone = (headerText.match(PHONE_RE) ?? [])
    .map((p) => p.trim())
    .find((p) => p.replace(/\D/g, "").length >= 10) ?? null;
  const nameLine = header.find(looksLikeName) ?? null;

  // Whatever is left on the contact line after removing email/phone/links is the location.
  let location: string | null = null;
  for (const h of header) {
    if (h === nameLine) continue;
    const rest = h
      .replace(EMAIL_RE, "")
      .replace(URL_RE, "")
      .replace(PHONE_RE, "")
      .split(/\s*[|·•,]\s*|\s{2,}/)
      .map((p) => p.trim())
      .filter((p) => p && !/^[+\d\s()-]+$/.test(p));
    if (rest.length) {
      location = rest.join(", ");
      break;
    }
  }

  const displayName =
    nameLine && nameLine === nameLine.toUpperCase()
      ? nameLine.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
      : nameLine;
  const contact: ContactDetails = { name: displayName, email, phone, location };
  if (nameLine) removed.push("name");
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
  if (nameLine) {
    for (const part of nameLine.split(/\s+/).filter((p) => p.length >= 3)) {
      text = text.replace(new RegExp(`\\b${escapeRe(part)}\\b`, "gi"), "the candidate");
    }
  }
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
