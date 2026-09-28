import { describe, expect, it } from "vitest";
import {
  compareCandidates,
  evaluate,
  experienceGate,
  inconsistentCategories,
  locationGate,
  lowestCategories,
  total,
  type Scores,
} from "./rubric";

const mk = (ops: number, noLayer: number, built: number, hard: number, craft: number, crisis: number, integ = 1): Scores => ({
  ops_ground: { score: ops, evidence: "" },
  no_layer: { score: noLayer, evidence: "" },
  built_missing: { score: built, evidence: "" },
  hard_calls: { score: hard, evidence: "" },
  product_craft: { score: craft, evidence: "" },
  crisis: { score: crisis, evidence: "" },
  integrations: { score: integ, evidence: "" },
});

// Step 9 calibration scores as given in kargo_hiring_rubric.txt (PM weights), names removed.
const CALIBRATION: [string, "Exceeds" | "Other", Scores, number][] = [
  ["Exceeds hire 1", "Exceeds", mk(5, 5, 5, 5, 5, 4), 98],
  ["Exceeds hire 2", "Exceeds", mk(5, 4, 5, 4, 3, 5), 87],
  ["Exceeds hire 3", "Exceeds", mk(5, 5, 5, 5, 1, 4), 86],
  ["Exceeds hire 4", "Exceeds", mk(5, 5, 5, 3, 2, 5), 85],
  ["Exceeds hire 5", "Exceeds", mk(5, 4, 5, 4, 2, 5), 84],
  ["Meets/Below hire 1", "Other", mk(1, 5, 5, 2, 1, 1), 51],
  ["Meets/Below hire 2", "Other", mk(3, 2, 3, 2, 1, 4), 49],
  ["Meets/Below hire 3", "Other", mk(1, 2, 4, 2, 5, 1), 48],
];

describe("total()", () => {
  it.each(CALIBRATION)("%s scores the reference total_pm", (_n, _r, scores, expected) => {
    expect(total(scores, "PM")).toBe(expected);
  });

  it("passes the calibration condition: every Exceeds hire above every other hire", () => {
    const exceeds = CALIBRATION.filter((c) => c[1] === "Exceeds").map((c) => total(c[2], "PM"));
    const others = CALIBRATION.filter((c) => c[1] === "Other").map((c) => total(c[2], "PM"));
    expect(Math.min(...exceeds)).toBeGreaterThan(Math.max(...others));
  });

  it("ranges from 20 to 100", () => {
    expect(total(mk(1, 1, 1, 1, 1, 1, 1), "SPM")).toBe(20);
    expect(total(mk(5, 5, 5, 5, 5, 5, 5), "SPM")).toBe(100);
  });

  it("ignores integrations for PM and weights it 15 for SPM", () => {
    const low = mk(3, 3, 3, 3, 3, 3, 1);
    const high = mk(3, 3, 3, 3, 3, 3, 5);
    expect(total(low, "PM")).toBe(total(high, "PM"));
    expect(total(high, "SPM") - total(low, "SPM")).toBe(12);
  });
});

describe("gates", () => {
  it("experience: pass in or above range, fail below, stretch_review when ops_ground is 5", () => {
    expect(experienceGate(3, "PM", 2)).toBe("pass");
    expect(experienceGate(6, "PM", 2)).toBe("pass");
    expect(experienceGate(1, "PM", 4)).toBe("fail");
    expect(experienceGate(1, "PM", 5)).toBe("stretch_review");
    expect(experienceGate(3, "SPM", 5)).toBe("stretch_review");
    expect(experienceGate(null, "SPM", 5)).toBe("unknown");
  });

  it("location: only an explicit refusal fails", () => {
    expect(locationGate("mumbai")).toBe("pass");
    expect(locationGate("willing_to_relocate")).toBe("pass");
    expect(locationGate("elsewhere_not_stated")).toBe("unknown");
    expect(locationGate("unwilling")).toBe("fail");
  });
});

describe("evaluate()", () => {
  const base = { location: "mumbai" as const, workMode: "not_stated" as const };

  it("shortlists at >= 70 with ops >= 3 and no failed gate", () => {
    const e = evaluate({ ...base, scores: mk(5, 5, 5, 5, 5, 4), roleApplied: "PM", pmYears: 2 });
    expect(e.total_pm).toBe(98);
    expect(e.shortlist).toBe(true);
    expect(e.recommended_role).toBe("PM");
  });

  it("does not shortlist a high total with weak ops ground", () => {
    const e = evaluate({ ...base, scores: mk(2, 5, 5, 5, 5, 5, 5), roleApplied: "PM", pmYears: 3 });
    expect(e.total_pm).toBeGreaterThanOrEqual(70);
    expect(e.shortlist).toBe(false);
  });

  it("flags a role switch when the other role scores higher", () => {
    const e = evaluate({ ...base, scores: mk(4, 4, 2, 4, 4, 2, 5), roleApplied: "PM", pmYears: 6 });
    expect(e.recommended_role).toBe("SPM");
    expect(e.flags).toContain("role_switch");
    expect(e.flags).toContain("above_PM_range");
  });

  it("keeps a near miss as stretch_review, still shortlistable", () => {
    const e = evaluate({ ...base, scores: mk(5, 5, 5, 5, 5, 4), roleApplied: "PM", pmYears: 1 });
    expect(e.gates.experience).toBe("stretch_review");
    expect(e.flags).toContain("stretch_review");
    expect(e.shortlist).toBe(true);
  });

  it("drops from the shortlist when a gate fails", () => {
    const e = evaluate({ scores: mk(5, 5, 5, 5, 5, 4), roleApplied: "PM", pmYears: 3, location: "unwilling", workMode: "not_stated" });
    expect(e.shortlist).toBe(false);
  });
});

describe("ordering helpers", () => {
  it("tie-breaks on ops_ground, then no_layer", () => {
    const a = { best: 80, shortlist: true, scores: mk(5, 3, 3, 3, 3, 3) };
    const b = { best: 80, shortlist: true, scores: mk(4, 5, 3, 3, 3, 3) };
    expect(compareCandidates(a, b)).toBeLessThan(0);
    const c = { best: 80, shortlist: true, scores: mk(4, 4, 3, 3, 3, 3) };
    expect(compareCandidates(b, c)).toBeLessThan(0);
  });

  it("picks the two lowest weighted categories, ignoring integrations for PM", () => {
    expect(lowestCategories(mk(5, 5, 2, 5, 1, 5, 1), "PM")).toEqual(["product_craft", "built_missing"]);
  });

  it("flags categories that move by 2+ between runs", () => {
    expect(inconsistentCategories(mk(5, 3, 3, 3, 3, 3), mk(3, 4, 3, 3, 3, 1))).toEqual(["ops_ground", "crisis"]);
  });
});
