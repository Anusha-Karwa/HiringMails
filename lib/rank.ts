import { CATEGORY_IDS, compareCandidates, type Role } from "./rubric";
import type { Candidate } from "./types";

export type Ranked = Candidate & { best: number; bestRole: Role };

/** Scored candidates in rubric order (shortlist, total, ops_ground, no_layer); unscored at the end. */
export function rankCandidates(list: Candidate[]): { ranked: Ranked[]; unscored: Candidate[] } {
  const ranked: Ranked[] = [];
  const unscored: Candidate[] = [];
  for (const c of list) {
    if (!c.analysis || !c.evaluation) {
      unscored.push(c);
      continue;
    }
    const bestRole = c.evaluation.recommended_role;
    ranked.push({ ...c, bestRole, best: bestRole === "PM" ? c.evaluation.total_pm : c.evaluation.total_spm });
  }
  ranked.sort((a, b) =>
    compareCandidates(
      { best: a.best, shortlist: a.evaluation!.shortlist, scores: a.analysis!.scores },
      { best: b.best, shortlist: b.evaluation!.shortlist, scores: b.analysis!.scores },
    ),
  );
  return { ranked, unscored };
}

export const barScores = (c: Candidate) => CATEGORY_IDS.map((id) => c.analysis?.scores[id]?.score ?? 1);
