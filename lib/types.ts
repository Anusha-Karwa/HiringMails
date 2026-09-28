import type { CategoryId, Evaluation, LocationSignal, Role, Scores, WorkModeSignal } from "./rubric";

export type Decision = "pending" | "advance" | "pass";
export type Confidence = "high" | "medium" | "low";

/** What the AI returns for one CV (after validation). Never contains contact details. */
export interface Analysis {
  summary: string; // who they are, in 2-3 sentences, no name
  pm_years: number | null;
  pm_years_evidence: string;
  location_signal: LocationSignal;
  location_evidence: string;
  work_mode_signal: WorkModeSignal;
  scores: Scores;
  unverified: CategoryId[]; // categories whose quote wasn't found in the CV, so the score was reset to 1
  red_flags: string[];
  thin_cv: boolean;
  confidence: Confidence;
  why_ranked_here: string;
  strengths: string[];
  probe_questions: { category: CategoryId; question: string }[];
  model: string;
  scored_at: string;
}

export interface EmailDraft {
  kind: "invite" | "rejection";
  subject: string;
  body: string;
  drafted_at: string;
  schedule_line?: string; // the scheduling sentence in the body, swapped when the slot changes
}

export interface Candidate {
  id: string;
  created_at: string;
  file_name: string;
  role_applied: Role;
  // Contact details: stored for emailing, never sent to the AI.
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  redacted_text: string;
  removed: string[];
  analysis: Analysis | null;
  evaluation: Evaluation | null;
  flags: string[];
  score_runs: number;
  error: string | null;
  decision: Decision;
  decided_at: string | null;
  email_draft: EmailDraft | null;
  email_sent_at: string | null;
  email_sent_to: string | null;
  // Interview slot (IST), set by the founder after Advance. Feeds the calendar.
  interview_at: string | null;
  interview_minutes: number | null;
  interview_mode: "in_person" | "video" | null;
  interview_link: string | null;
}

export type NewCandidate = Omit<Candidate, "id" | "created_at">;
