/**
 * The Kargo hiring rubric (kargo_hiring_rubric.txt), as code.
 *
 * The AI only reads the CV and proposes a 1-5 score per category with a quoted evidence line.
 * Everything that decides rank lives here and is deterministic: quote verification, weights,
 * totals, gates, shortlist and tie-break. Same AI output in, same ranking out.
 */

export type Role = "PM" | "SPM";
export const ROLES: Role[] = ["PM", "SPM"];

export const CATEGORIES = [
  { id: "ops_ground", rank: 1, label: "Ground-level freight / logistics ops", short: "Ops ground", pm: 25, spm: 20 },
  { id: "no_layer", rank: 2, label: "Owned the outcome with no layer above", short: "No layer", pm: 20, spm: 20 },
  { id: "built_missing", rank: 3, label: "Built the missing system, others adopted it", short: "Built missing", pm: 15, spm: 10 },
  { id: "hard_calls", rank: 4, label: "Makes hard calls and owns the misses", short: "Hard calls", pm: 15, spm: 15 },
  { id: "product_craft", rank: 5, label: "Discovery, roadmap, shipping with engineering", short: "Product craft", pm: 15, spm: 15 },
  { id: "crisis", rank: 6, label: "Composure in live operational crises", short: "Crisis", pm: 10, spm: 5 },
  { id: "integrations", rank: 7, label: "Integration and data-layer experience", short: "Integrations", pm: 0, spm: 15 },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export const EXPERIENCE_RANGE: Record<Role, [number, number]> = { PM: [2, 4], SPM: [5, 8] };

export const SHORTLIST_MIN_TOTAL = 70;
export const SHORTLIST_MIN_OPS = 3;

export type Scores = Record<CategoryId, { score: number; evidence: string }>;
export type GateResult = "pass" | "fail" | "stretch_review" | "unknown";

/** total = sum(score * weight) / 5, range 20..100 */
export function total(scores: Scores, role: Role): number {
  let sum = 0;
  for (const c of CATEGORIES) sum += clampScore(scores[c.id]?.score) * (role === "PM" ? c.pm : c.spm);
  return Math.round((sum / 5) * 10) / 10;
}

export function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(5, Math.max(1, v));
}

/**
 * Experience gate. Below the range is a fail, except the rubric's near miss: a 5 on the rank-1
 * category (ops_ground) turns it into stretch_review so Arjun still sees them. Above the range is
 * not a fail (the rubric never says "too senior"); it shows up as a role_switch instead.
 */
export function experienceGate(pmYears: number | null, role: Role, opsGround: number): GateResult {
  if (pmYears === null || !Number.isFinite(pmYears)) return "unknown";
  const [min] = EXPERIENCE_RANGE[role];
  if (pmYears >= min) return "pass";
  return opsGround >= 5 ? "stretch_review" : "fail";
}

export type LocationSignal = "mumbai" | "willing_to_relocate" | "elsewhere_not_stated" | "unwilling" | "not_stated";
export type WorkModeSignal = "in_office_ok" | "remote_only" | "not_stated";

/** A CV that doesn't mention relocation is "unknown", never "fail". Only an explicit no fails. */
export function locationGate(signal: LocationSignal): GateResult {
  if (signal === "mumbai" || signal === "willing_to_relocate") return "pass";
  if (signal === "unwilling") return "fail";
  return "unknown";
}

export function workModeGate(signal: WorkModeSignal): GateResult {
  if (signal === "in_office_ok") return "pass";
  if (signal === "remote_only") return "fail";
  return "unknown";
}

export interface Gates {
  experience: GateResult;
  location: GateResult;
  work_mode: GateResult;
}

export const gatesFail = (g: Gates) => g.experience === "fail" || g.location === "fail" || g.work_mode === "fail";

export interface Evaluation {
  total_pm: number;
  total_spm: number;
  recommended_role: Role;
  gates: Gates; // for the recommended role
  gates_applied: Gates; // for the role they applied to
  shortlist: boolean;
  flags: string[];
}

export function evaluate(input: {
  scores: Scores;
  roleApplied: Role;
  pmYears: number | null;
  location: LocationSignal;
  workMode: WorkModeSignal;
}): Evaluation {
  const { scores, roleApplied, pmYears } = input;
  const total_pm = total(scores, "PM");
  const total_spm = total(scores, "SPM");
  // Ties go to the role they applied for.
  const recommended_role: Role =
    total_pm === total_spm ? roleApplied : total_pm > total_spm ? "PM" : "SPM";

  const ops = clampScore(scores.ops_ground?.score);
  const gatesFor = (role: Role): Gates => ({
    experience: experienceGate(pmYears, role, ops),
    location: locationGate(input.location),
    work_mode: workModeGate(input.workMode),
  });
  const gates = gatesFor(recommended_role);
  const gates_applied = gatesFor(roleApplied);

  const best = recommended_role === "PM" ? total_pm : total_spm;
  const shortlist = best >= SHORTLIST_MIN_TOTAL && ops >= SHORTLIST_MIN_OPS && !gatesFail(gates);

  const flags: string[] = [];
  if (recommended_role !== roleApplied) flags.push("role_switch");
  if (gates.experience === "stretch_review" || gates_applied.experience === "stretch_review") flags.push("stretch_review");
  if (pmYears !== null && pmYears > EXPERIENCE_RANGE[roleApplied][1]) flags.push(`above_${roleApplied}_range`);
  return { total_pm, total_spm, recommended_role, gates, gates_applied, shortlist, flags };
}

/** Sort: shortlisted first, then total for the recommended role, then ops_ground, then no_layer. */
export function compareCandidates(
  a: { best: number; shortlist: boolean; scores: Scores },
  b: { best: number; shortlist: boolean; scores: Scores },
): number {
  if (a.shortlist !== b.shortlist) return a.shortlist ? -1 : 1;
  if (b.best !== a.best) return b.best - a.best;
  const ops = clampScore(b.scores.ops_ground?.score) - clampScore(a.scores.ops_ground?.score);
  if (ops) return ops;
  return clampScore(b.scores.no_layer?.score) - clampScore(a.scores.no_layer?.score);
}

/** Two lowest-scoring categories that matter for this role (weight > 0); probes are written from these. */
export function lowestCategories(scores: Scores, role: Role, n = 2): CategoryId[] {
  return CATEGORIES.filter((c) => (role === "PM" ? c.pm : c.spm) > 0)
    .map((c) => ({ id: c.id, s: clampScore(scores[c.id]?.score), rank: c.rank }))
    .sort((a, b) => a.s - b.s || a.rank - b.rank)
    .slice(0, n)
    .map((c) => c.id);
}

/** Rule 7: flag any category that moved by 2+ between two runs. */
export function inconsistentCategories(prev: Scores, next: Scores): CategoryId[] {
  return CATEGORY_IDS.filter((id) => Math.abs(clampScore(prev[id]?.score) - clampScore(next[id]?.score)) >= 2);
}
