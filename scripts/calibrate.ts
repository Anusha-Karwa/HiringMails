/**
 * Rubric Step 9: score a folder of past-hire CVs with the real pipeline (redaction -> Gemini -> rubric
 * code, PM weights) and check that every Exceeds hire scores above every Meets/Below hire.
 *
 *   npm run calibrate -- <folder of past-hire CVs, with ratings.json>
 *
 * Nothing is stored. Needs GEMINI_API_KEY in .env.local.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { extractText } from "../lib/extract";
import { scoreCv } from "../lib/gemini";
import { prepareCv } from "../lib/pii";
import { CATEGORY_IDS, total } from "../lib/rubric";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type Rating = "Exceeds" | "Meets" | "Below";

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Usage: npm run calibrate -- <folder>");
  // ratings.json in the folder: { "<file name>": "Exceeds" | "Meets" | "Below" }
  const ratingsPath = path.join(dir, "ratings.json");
  if (!existsSync(ratingsPath)) throw new Error(`Add ${ratingsPath} mapping each CV file name to Exceeds, Meets or Below.`);
  const RATINGS = JSON.parse(readFileSync(ratingsPath, "utf8")) as Record<string, Rating>;
  const files = readdirSync(dir).filter((f) => /\.(docx|pdf|txt)$/i.test(f));
  const rows: { name: string; rating: string; scores: number[]; pm: number; unverified: string[] }[] = [];

  for (const f of files) {
    const raw = await extractText(f, readFileSync(path.join(dir, f)));
    const prepared = prepareCv(raw, f);
    const a = await scoreCv(prepared.redacted, "PM");
    rows.push({
      name: prepared.contact.name ?? f,
      rating: RATINGS[f] ?? "?",
      scores: CATEGORY_IDS.map((id) => a.scores[id].score),
      pm: total(a.scores, "PM"),
      unverified: a.unverified,
    });
    process.stdout.write(".");
  }
  console.log("\n");
  rows.sort((a, b) => b.pm - a.pm);
  console.log(["Hire".padEnd(22), "Rating ", "ops nl  bm  hc  pc  cr  in", " total_pm"].join(" "));
  for (const r of rows) {
    console.log(
      [r.name.padEnd(22), r.rating.padEnd(7), r.scores.map((s) => String(s).padEnd(3)).join(" "), String(r.pm).padStart(6)].join(" ") +
        (r.unverified.length ? `   (quote not found: ${r.unverified.join(", ")})` : ""),
    );
  }
  const ex = rows.filter((r) => r.rating === "Exceeds").map((r) => r.pm);
  const other = rows.filter((r) => r.rating === "Meets" || r.rating === "Below").map((r) => r.pm);
  if (!ex.length || !other.length) return console.log("\nNeed both Exceeds and Meets/Below CVs to check calibration.");
  const pass = Math.min(...ex) > Math.max(...other);
  console.log(`\nmin(Exceeds) = ${Math.min(...ex)}  vs  max(others) = ${Math.max(...other)}  ->  ${pass ? "PASS" : "FAIL: fix the prompt"}`);
  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
