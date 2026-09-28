-- Kargo hiring dashboard schema. Paste into Supabase -> SQL Editor -> Run. Safe to re-run.
--
-- Access model: the Next.js server talks to Postgres with the service_role key (bypasses RLS).
-- RLS is enabled with NO policies, so the public anon key can read nothing. Candidate contact
-- details live only here; the AI receives redacted_text and nothing else.

create extension if not exists pgcrypto;

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  file_name text not null,
  role_applied text not null check (role_applied in ('PM', 'SPM')),

  -- contact details (never sent to the AI)
  name text,
  email text,
  phone text,
  location text,

  redacted_text text not null,          -- the only CV text the AI sees
  removed text[] not null default '{}', -- what redaction stripped (name, email, education section...)

  analysis jsonb,                       -- AI scores + evidence quotes + brief (lib/types.ts -> Analysis)
  evaluation jsonb,                     -- deterministic totals, gates, shortlist (lib/rubric.ts -> Evaluation)
  flags text[] not null default '{}',
  score_runs integer not null default 0,
  error text,

  decision text not null default 'pending' check (decision in ('pending', 'advance', 'pass')),
  decided_at timestamptz,
  email_draft jsonb,                    -- {kind, subject, body, drafted_at}
  email_sent_at timestamptz,
  email_sent_to text,

  -- interview slot, feeds the founder's calendar
  interview_at timestamptz,
  interview_minutes integer,
  interview_mode text check (interview_mode in ('in_person', 'video')),
  interview_link text
);

-- Upgrading an existing table from the first version:
alter table candidates add column if not exists interview_at timestamptz;
alter table candidates add column if not exists interview_minutes integer;
alter table candidates add column if not exists interview_mode text;
alter table candidates add column if not exists interview_link text;

create index if not exists candidates_created_idx on candidates (created_at desc);

alter table candidates enable row level security;
