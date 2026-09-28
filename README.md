# Kargo Hire

A hiring dashboard for Arjun, founder of Kargo (Series A logistics SaaS, Mumbai), who is hiring a **Product Manager** and a **Senior Product Manager** with no HR team.

Upload a CV and pick the role applied for. The dashboard redacts it, scores it against **both** the PM and SPM rubrics (built from the pattern in Arjun's best past hires, not the job spec), ranks everyone, and gives him an interview brief. He clicks **Advance** or **Pass**, reviews the drafted email, and clicks **Send**.

> The system recommends. Arjun decides. That decision is the last thing he touches.

## Components map

| Stage | What happens | Where |
|---|---|---|
| **Trigger** | Founder uploads CVs and selects the applied role (PM / SPM) | `app/upload`, `components/UploadForm.tsx` |
| **Input** | CV file (.docx, .pdf, .txt) + role | `app/api/candidates/route.ts`, `lib/extract.ts` |
| **Context** | Extract contact details into the database; build a redacted text with name, email, phone, links, education section, personal-detail lines and gendered pronouns removed. Only this text reaches the AI. | `lib/pii.ts` |
| **Processing** | Rubric in code: quote verification, weights, PM + SPM totals, gates, shortlist rule, tie-break, role switch | `lib/rubric.ts`, `lib/pipeline.ts` |
| **AI** | Gemini (temperature 0) proposes a 1-5 score per category with an exact quote, plus summary, strengths and 3 probe questions. After the founder decides, Gemini drafts the invite or rejection email. | `lib/gemini.ts` |
| **Output** | Ranked dashboard, candidate brief, editable draft, one-click send via Resend | `app/page.tsx`, `app/c/[id]`, `lib/email.ts` |
| **Calendar** | After Advance, Arjun books a slot. Interviews, next-morning follow-ups, chase reminders and a daily review block go into a calendar feed he subscribes to once; booked invites also carry an .ics for him and the candidate | `lib/ics.ts`, `lib/hiring-calendar.ts`, `app/calendar`, `app/api/calendar` |

## How the rubric is enforced

- **No quote, no score.** Every score above 1 must come with a line from the CV. The server checks that the quote actually appears in the text the AI was given; if not, the score is reset to 1 and flagged `unverified_quote`.
- **Blind scoring by construction.** The AI never receives the name, contact details, links or the education section, so it can't reward pedigree or be biased by name or gender.
- **The AI never ranks.** Totals (`Σ score × weight ÷ 5`), gates, shortlist (`total ≥ 70 AND ops_ground ≥ 3 AND no failed gate`) and tie-break (ops ground, then no layer) are deterministic code.
- **Both roles, always.** `total_pm` and `total_spm` for every CV; `role_switch` if the other role scores higher.
- **Gates never reject on silence.** A CV that doesn't mention location is `unknown`, not `fail`. Short on PM years with ops ground = 5 becomes `stretch_review`.
- **Thin CVs** get `needs_human_read` and low confidence instead of a low score. **Red flags** lower confidence, never reject.
- **Consistency.** Re-score runs the same prompt; any category that moves by 2+ is flagged `inconsistent`.
- **No email on score alone.** Emails are drafted only after Advance / Pass, and sent only on Send. The AI writes `{{first_name}}`, and the server fills in the name at send time.

### Calibration (rubric step 9)

```bash
npm run calibrate -- "C:/path/to/hires"
```

Scores a folder of past-hire CVs with the real pipeline (PM weights) and checks that every Exceeds hire ranks above every Meets/Below hire. Put a `ratings.json` in the folder mapping each file name to its rating, e.g. `{"hire_a.pdf": "Exceeds", "hire_b.docx": "Meets"}`. Nothing is stored.

## Run locally

Requires Node 18.17+ (20+ recommended).

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
npm test                     # rubric maths, calibration table, redaction, quote checks
```

Without Supabase the app runs on in-memory storage (a banner says so). Without `GEMINI_API_KEY` CVs are stored but not scored. Without `RESEND_API_KEY` the Send button is disabled.

## Calendar

Open **Calendar** in the dashboard and click **Add to Google Calendar** (or Apple / Outlook, or copy the feed link). The feed holds:

| Event | When | Reminder |
|---|---|---|
| Interview, with score, why ranked here and the 3 probe questions in the notes | the booked slot (IST) | 1 day and 30 min before |
| "Decide on X after yesterday's interview" | 10:00 the next morning | at start |
| "Chase X: interview not booked yet" | 3 days after an invite sent without a slot | at start |
| "Hiring: N awaiting your call" | next weekday 9:30, while anyone is pending | 10 min before |

Google refreshes subscribed calendars every few hours, so when an invite with a slot is sent, Arjun (`FOUNDER_EMAIL`) also gets an email with an `.ics` that lands in his calendar immediately, and the candidate's email carries their own invite. Each booked interview also has **Add to Google Calendar** and `.ics` links. The feed URL carries a private token derived from `DASHBOARD_PASSWORD`, since calendar apps can't log in. No Google Cloud or OAuth setup is needed.

If you already ran the first version of `schema.sql`, run it again: it adds the interview columns.

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → New query → paste `supabase/schema.sql` → Run.
3. Project Settings → API: copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL` and the secret / service_role key into `SUPABASE_SERVICE_ROLE_KEY`.

RLS is on with no policies, so the public anon key can read nothing. All access goes through the server.

## Set up Resend

1. Create an API key at [resend.com/api-keys](https://resend.com/api-keys) → `RESEND_API_KEY`.
2. Until you verify a domain, the sender must be `onboarding@resend.dev`, and Resend only delivers to **your own account email**. Set `EMAIL_TEST_RECIPIENT` to that address, and every email goes there instead of the candidate.
3. To email candidates for real, verify a domain in Resend, set `RESEND_FROM` to an address on it, and remove `EMAIL_TEST_RECIPIENT`.

## Deploy (Vercel)

Push to GitHub, import the repo in Vercel, add the env vars from `.env.example` (including `DASHBOARD_PASSWORD`, because candidate data is private), and deploy.

## Environment variables

| Name | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | for persistence | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for persistence | Server-only |
| `GEMINI_API_KEY` | for scoring | |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest` |
| `RESEND_API_KEY` | for sending | |
| `RESEND_FROM` | no | Defaults to `Kargo Hiring <onboarding@resend.dev>` |
| `RESEND_REPLY_TO` | no | |
| `EMAIL_TEST_RECIPIENT` | recommended while testing | Redirects every email |
| `INTERVIEW_BOOKING_URL` | no | Added to invites |
| `FOUNDER_EMAIL` | recommended | Gets a calendar copy of each booked interview |
| `APP_URL` | no | Public URL for links in calendar events and emails |
| `DASHBOARD_PASSWORD` | yes on Vercel | Password gate for the whole app |

## Tech

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase · Gemini (`@google/generative-ai`) · Resend · mammoth (docx) · unpdf (PDF) · Vitest.

Kargo, Arjun Mehta and the candidates are fictional (MESA Case 2).
