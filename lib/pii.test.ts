import { describe, expect, it } from "vitest";
import { toAnalysis } from "./gemini";
import { prepareCv, quoteIsInText } from "./pii";

// Invented test CV (not a real applicant).
const CV = `Test Candidate
test.candidate@example.com  |  +91 90000 00000  |  Pune  |  linkedin.com/in/test-candidate

Summary
Product Manager with 3 years in PM roles. She owns product areas independently.
Experience
Product Manager · Example Freight Co · Jan 2023 – Present
—  Sole PM for the shipment documentation module, reporting to the CEO
—  Review note: "Test is the PM we trust with hard calls. She doesn't hedge."
Education
B.Tech · Example Institute of Technology · 2015–2019 · Rank holder
Certifications & Tools
JIRA · SQL · CargoWise
`;

describe("prepareCv()", () => {
  const p = prepareCv(CV);

  it("pulls contact details out for the database", () => {
    expect(p.contact.name).toBe("Test Candidate");
    expect(p.contact.email).toBe("test.candidate@example.com");
    expect(p.contact.phone).toContain("90000");
    expect(p.contact.location).toBe("Pune");
  });

  it("keeps name, email, phone, links and education away from the AI", () => {
    const t = p.redacted.toLowerCase();
    for (const s of ["test candidate", "example.com", "90000", "linkedin", "example institute", "rank holder", "b.tech"]) {
      expect(t).not.toContain(s);
    }
    expect(p.redacted).not.toMatch(/\bTest\b/);
    expect(p.removed).toEqual(expect.arrayContaining(["name", "email", "phone", "education section"]));
  });

  it("keeps the evidence that matters, with neutral pronouns", () => {
    expect(p.redacted).toContain("Sole PM for the shipment documentation module");
    expect(p.redacted).toContain("Location (from CV header): Pune");
    expect(p.redacted).toContain("they owns product areas independently");
    expect(p.redacted).toContain("CargoWise");
    expect(p.redacted).not.toMatch(/\bshe\b/i);
  });

  it("drops personal-detail lines", () => {
    const q = prepareCv("Asha Rao\nMumbai\nSummary\nDate of Birth: 01/01/1995\nGender: Female\nBuilt the carrier module.");
    expect(q.redacted).not.toMatch(/birth|female/i);
    expect(q.redacted).toContain("Built the carrier module.");
  });
});

describe("quoteIsInText()", () => {
  const text = "—  Shipped 6 features across 12 months; killed 2 after early usage data showed low adoption";
  it("accepts exact quotes regardless of case, dashes and spacing", () => {
    expect(quoteIsInText("shipped 6 features   across 12 months; KILLED 2", text)).toBe(true);
    expect(quoteIsInText("“Shipped 6 features across 12 months”", text)).toBe(true);
  });
  it("accepts fragments joined by an ellipsis", () => {
    expect(quoteIsInText("Shipped 6 features ... killed 2 after early usage data", text)).toBe(true);
  });
  it("rejects paraphrases and empty quotes", () => {
    expect(quoteIsInText("Shipped six features and killed two", text)).toBe(false);
    expect(quoteIsInText("", text)).toBe(false);
  });
});

describe("toAnalysis() enforces no quote, no score", () => {
  it("resets a score to 1 when its quote isn't in the CV", () => {
    const cvText = "Sole PM responsible for dock scheduling, reporting to the CEO.";
    const a = toAnalysis(
      {
        scores: {
          no_layer: { score: 5, evidence: "Sole PM responsible for dock scheduling" },
          ops_ground: { score: 4, evidence: "Ran customs clearance at JNPT" },
          crisis: { score: 9, evidence: "" },
        },
        confidence: "high",
        red_flags: ["only wins listed"],
      },
      cvText,
      "test",
    );
    expect(a.scores.no_layer.score).toBe(5);
    expect(a.scores.ops_ground.score).toBe(1);
    expect(a.scores.crisis.score).toBe(1);
    expect(a.unverified).toEqual(["ops_ground", "crisis"]);
    expect(a.scores.hard_calls.score).toBe(1);
    expect(a.confidence).toBe("medium"); // red flags lower confidence
  });
});
