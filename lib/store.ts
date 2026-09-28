import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Candidate, NewCandidate } from "./types";

export interface Store {
  kind: "supabase" | "memory";
  list(): Promise<Candidate[]>;
  get(id: string): Promise<Candidate | null>;
  create(c: NewCandidate): Promise<Candidate>;
  update(id: string, patch: Partial<NewCandidate>): Promise<Candidate>;
  remove(id: string): Promise<void>;
}

const COLS =
  "id, created_at, file_name, role_applied, name, email, phone, location, redacted_text, removed, analysis, evaluation, flags, score_runs, error, decision, decided_at, email_draft, email_sent_at, email_sent_to, interview_at, interview_minutes, interview_mode, interview_link";

function supabaseStore(url: string, key: string): Store {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = <T,>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.data;
  };
  return {
    kind: "supabase",
    async list() {
      return check(await db.from("candidates").select(COLS).order("created_at", { ascending: false })) as Candidate[];
    },
    async get(id) {
      return check(await db.from("candidates").select(COLS).eq("id", id).maybeSingle()) as Candidate | null;
    },
    async create(c) {
      return check(await db.from("candidates").insert(c).select(COLS).single()) as Candidate;
    },
    async update(id, patch) {
      return check(await db.from("candidates").update(patch).eq("id", id).select(COLS).single()) as Candidate;
    },
    async remove(id) {
      check(await db.from("candidates").delete().eq("id", id));
    },
  };
}

// In-memory fallback so the app runs with no database (data is lost on restart).
const g = globalThis as unknown as { __kargoMem?: Map<string, Candidate> };
function memoryStore(): Store {
  const mem = (g.__kargoMem ??= new Map());
  return {
    kind: "memory",
    async list() {
      return Array.from(mem.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async get(id) {
      return mem.get(id) ?? null;
    },
    async create(c) {
      const row: Candidate = { ...c, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      mem.set(row.id, row);
      return row;
    },
    async update(id, patch) {
      const cur = mem.get(id);
      if (!cur) throw new Error("Candidate not found");
      const next = { ...cur, ...patch };
      mem.set(id, next);
      return next;
    },
    async remove(id) {
      mem.delete(id);
    },
  };
}

let cached: Store | null = null;
export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? supabaseStore(url, key) : memoryStore();
  return cached;
}
