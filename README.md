# Land — AI Powered Job Prep

Land helps candidates prepare for a specific job. You paste in a job
description, run a live **voice** mock interview against an AI interviewer that
asks follow-ups based on that role, and then get written, scored feedback on how
you did.

Under the hood: Next.js 16 (App Router, Turbopack) and React 19, Clerk for auth
and billing, Postgres via Drizzle ORM, [Hume EVI](https://platform.hume.ai) for
the voice conversation, and Google Gemini (through the Vercel AI SDK) for the
written feedback. `proxy.ts` layers Clerk auth over Arcjet shield, bot detection
and rate limiting.

## Prerequisites

- **Node 20.9+** (see `.nvmrc` — `nvm use` picks it up)
- **Docker Desktop**, for the local Postgres container
- Accounts on four external services: **Clerk**, **Hume AI**, **Google AI
  Studio**, **Arcjet**. All four have free tiers.

## Local setup

The order matters. `docker compose` interpolates the `DB_*` group out of `.env`,
so the file has to exist before the container starts.

```bash
git clone https://github.com/JordanGrieve/ai-powered-job-prep.git
cd ai-powered-job-prep
npm install
cp .env.example .env      # then fill it in — see below
docker compose up -d --wait
npm run db:migrate
npm run dev
```

> **Copy to `.env`, not `.env.local`.** Docker Compose only ever reads `.env`.
> Following the usual Next.js convention gives you a working app sitting next to
> a Postgres container configured with empty strings.

`.env.example` documents all 15 required variables and where to obtain each one.
They are validated by Zod at module load in `app/data/env/{server,client}.ts`,
and those modules are imported by `proxy.ts`, `app/drizzle/db.ts` and
`drizzle.config.ts` — so a **partially** filled `.env` fails fast at middleware
import rather than at the point of use. That is deliberate.

Two values need explaining beyond the comments in `.env.example`; see
[Clerk Billing](#clerk-billing) and [Hume EVI](#hume-evi-configuration) below.

### Database commands

| Command | Use |
| --- | --- |
| `npm run db:migrate` | **Setup and deploy.** Applies committed migrations. |
| `npm run db:generate` | After changing `app/drizzle/schema/*` — emits a new migration. |
| `npm run db:push` | Local prototyping only. Diffs against a live database and **will drop columns and enum values** to converge. Leaves no history. |
| `npm run db:studio` | Drizzle Studio. |
| `npm run db:seed -- user_2abc...` | Local fixtures for your Clerk user (see `app/drizzle/seed.ts`). |

### Verification

```bash
npm run lint        # eslint, zero warnings tolerated
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build
```

CI (`.github/workflows/ci.yml`) runs exactly these four on every PR.

## Project layout

| Path | What lives there |
| --- | --- |
| `app/app/` | The authenticated application. The doubled segment is intentional: the route prefix is literally `/app`. |
| `app/features/<domain>/` | Domain slices — `actions.ts` (server actions), `db.ts` (writes + cache invalidation), `dbCache.ts` (tag helpers), `permissions.ts` (entitlement gates), `schema.ts` (Zod). |
| `app/services/<vendor>/` | Third-party integration: `clerk/`, `hume/`, `ai/`. |
| `app/drizzle/` | Schema, migrations, pooled client, seed script. |
| `app/data/env/` | Zod-validated environment, split server/client. |
| `components/` | Shared UI. `components/ui/` is shadcn-generated. |
| `lib/` | Cross-cutting helpers — cache tags, logger, error toasts, formatters. |
| `proxy.ts` | **Next 16's renamed middleware.** Not a stray file. |

### `proxy.ts`

This is the app's only authorization boundary. It:

- declares the public routes (`/`, `/sign-in`, `/sign-up`, `/api/webhooks/*`)
  and calls `auth.protect()` on everything else;
- runs Arcjet shield, bot detection and a 50/min sliding window — **except** on
  `/api/webhooks/*`, which must bypass it (Svix is not an allowed bot category,
  and a 403 there silently drops every Clerk user event forever);
- returns 429 with `Retry-After` for rate-limit denials, 403 otherwise, and logs
  `decision.reason` either way.

### The interview flow

1. `createInterview` — authenticates, checks the plan, verifies job-info
   ownership, spends an Arcjet token, inserts a row with `humeChatId: null`.
2. `_StartCall.tsx` opens the Hume voice session with the job info passed as
   session variables.
3. Hume returns a chat id; the client writes it back via `updateInterview`.
   **This is where plan quota is actually consumed** — the limit counts
   interviews with a non-null `humeChatId` — so the plan is re-checked here, and
   the field is write-once.
4. On disconnect the final duration is written, then the client navigates to the
   interview page.
5. `generateInterviewFeedback` fetches the transcript from Hume and sends it to
   Gemini. It is idempotent, separately rate-limited, and refuses to persist
   truncated output.

## Clerk Billing

Entitlements are **not** in this repo. `app/services/clerk/lib/hasPermission.ts`
resolves Clerk Billing *features* by slug via `auth().has({ feature })`, and the
plans that carry them are configured in the Clerk dashboard.

| Feature slug | Gates | Enforced in |
| --- | --- | --- |
| `unlimited_interviews` | Unlimited mock interviews | `features/interviews/permissions.ts` |
| `1_interview` | A single interview (free tier) | `features/interviews/permissions.ts` |
| `5_questions` | Five practice questions | `features/questions/permissions.ts` |
| `unlimited_questions` | Unlimited practice questions | `features/questions/permissions.ts` |
| `unlimited_resume_analysis` | Resume analysis | `features/resume/permissions.ts` |

Every slug is now enforced server-side, in the action as well as the page — the
page check is a redirect for the user's benefit; the action check is what stops
a direct POST.

Two things to know:

- **`1_interview` counts interviews with a non-null `humeChatId`**, not rows in
  the table. An interview that was created but never connected does not count.
- **With no Billing plans configured, every `has()` returns false.** That means
  `canCreateInterview()` is always false and interview creation is denied for
  everyone — while the app otherwise looks completely healthy, with no error
  anywhere pointing at the cause. If nobody can start an interview on a fresh
  Clerk instance, check this first.

## What the app does

Three things, each scoped to one job description:

- **Practice interviewing** — a live Hume EVI voice conversation, then written
  Gemini feedback scored across seven categories.
- **Answer technical questions** — generated at a chosen difficulty, with an
  AI review of the answer you type. Answers are not persisted.
- **Refine your resume** — upload a PDF (or `.txt`/`.md`) and get it assessed
  against that specific role. The file is sent to Gemini inline and is never
  stored.

Plus `/app/billing` for plan, usage and subscription management.

## Hume EVI configuration

`NEXT_PUBLIC_HUME_CONFIG_ID` points at a config you build by hand in the Hume
dashboard (EVI → Configs). Copy the config id from there, and the API/secret key
pair from the API keys page.

**The config's prompt must declare these four template variables:**

```
userName    title    description    experienceLevel
```

`app/app/job-infos/[jobinfoid]/interviews/new/_StartCall.tsx` is the source of
truth — it sends exactly those four as session variables when opening the
session. **Hume silently drops session variables it does not recognise**, so a
config whose prompt does not reference them produces an interviewer that ignores
the job context entirely, with no error in the app, in the browser console, or
in the Hume logs. If your AI interviewer is asking generic questions, this is
almost certainly why.

## Deployment notes

- `next.config.ts` still uses `experimental.useCache`, which is deprecated on
  16.3.x. Migrating to the top-level `cacheComponents` flag is a real
  prerendering migration, not a rename — it is tracked separately.
- The CSP in `next.config.ts` ships as **report-only**. Load `/app/upgrade` and a
  live interview page, confirm zero violations, then rename the header to
  `Content-Security-Policy`.
- Migrations must run before the new build serves traffic. The `migrate` job in
  `.github/workflows/ci.yml` does this on push to `main` and needs `DB_*`
  repository secrets.
