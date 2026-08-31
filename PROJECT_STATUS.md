# Project status

_Last updated: 2026-08-31. Branch: `remediation` (8 commits, unpushed)._

Asana board:
[AI Powered Job Prep — Remediation Backlog](https://app.asana.com/1/1217089553689849/project/1217990971905893)

## Where things stand

A 12-dimension audit of this repo produced 95 verified gaps, deduplicated into a
44-task backlog. **43 are complete, 1 is blocked on a decision, and 2 follow-ups
were opened during the work.**

The app went from *not building* to: clean typecheck, zero-warning lint, 39
passing unit tests, a passing production build, and CI wiring for all four.

### Verification status

| Gate | State |
| --- | --- |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 warnings (`--max-warnings 0`) |
| `npm test` | 39 passed, 3 files |
| `npm run build` | passes, 9/9 static pages |
| `npm run test:e2e` | **never run** — needs browsers, a database and Clerk test credentials |

## What changed

**Build blockers.** Three type errors broke `next build`: AI SDK v4 options
(`maxSteps`, `experimental_continueSteps`) passed to `generateText` on `ai@6`,
`imageUrl` typed `string | null` against a `notNull` column, and deep imports of
`hume/api/resources/empathicVoice`, a subpath the package no longer exports.
(The audit found two of the three; the Hume one surfaced only once `tsc` ran.)

**Security and tenancy.**
- Webhooks now bypass Arcjet. `detectBot` in LIVE mode was 403ing Svix, which
  silently dropped every Clerk user event — the root cause of new sign-ups
  hanging forever.
- `getUser(id)` was a `"use cache"` module imported by a client component: no
  RPC boundary (so `pg` reached the browser bundle) and no session check (so any
  signed-in user could read another's row by id). Replaced with a parameterless
  `"use server"` action.
- Interview actions now parse every input; `updateInterview` takes a `.strict()`
  allowlist, so `feedback`, `jobInfoId` and `createdAt` can no longer be written
  through it. `humeChatId` is write-once.
- `revalidateUserCache` was defined with zero call sites, so the onboarding poll
  cached a `null` user before the webhook landed and never re-read it.
- Baseline security headers plus a report-only CSP.

**Reliability.** AI and Hume failures are caught and typed; truncated output is
never persisted; the Gemini call has a timeout and token cap; feedback
generation is idempotent and separately rate-limited; the Hume transcript fetch
is tagged and revalidated to defeat the post-disconnect race.

**Product.** Both advertised-but-absent pillars are built — Questions (generate,
practice, AI review) and Resume (upload, analyse) — each gated on its Clerk
entitlement in both the page and the action. Plus a real landing page, error and
not-found boundaries, a working sign-up route, usage display, and `/app/billing`.

**Foundations.** Migration baseline committed (the directory had never existed),
FK indexes, a pooled HMR-safe Drizzle client, `.env.example`, a seed script, a
real README, Vitest, Playwright scaffolding, CI, and a move off the Next canary
channel to stable 16.3.3.

## Open

### Blocked — needs a decision

**Add error tracking and structured logging at service boundaries.** The logging
half is done: `lib/logger.ts` emits redacted structured JSON at four boundaries,
and `instrumentation.ts` exports `onRequestError`. The error-tracker itself is
not wired — that is a vendor choice (Sentry? Highlight? OTel to your own
collector?) with cost and data-residency implications, plus a DSN I don't have.
`register()` carries the exact four steps needed.

### Follow-ups opened during the work

- **Migrate `experimental.useCache` to `cacheComponents`.** Stable 16.3.3
  deprecates the flag. It is not a rename: `cacheComponents: true` fails the
  build with `CLIENT_HOOK_DYNAMIC` because the Navbar calls `usePathname()`
  outside a Suspense boundary. A real prerendering migration.

## What needs you

None of this is blocking further code work, but nothing below can be verified
without you.

1. **Push the branch** so CI executes for the first time, then make it a
   required status check on `main`.
2. **Run the migrations** against a fresh database:
   `docker compose down -v && docker compose up -d --wait && npm run db:migrate`.
   Note the schema has only ever been materialised by `db:push`, so an existing
   local database will likely conflict with baseline `0000`.
3. **Configure Clerk Billing plans.** With none configured, every `has()`
   returns false and nobody can start an interview — while the app looks
   perfectly healthy.
4. **Send one test Clerk webhook** of each kind. The user events are unit-tested;
   the *billing* events are not, and the payer-id path in the payload is my
   least confident guess in the whole run.
5. **Promote the CSP** from report-only once `/app/upgrade` and a live interview
   page report zero violations.
6. **Exercise Questions and Resume.** They are new features, fully typed and
   built but never executed against a real database or Gemini key.
7. **Pick an error tracker** (see Blocked above).

## Caveat on "done"

Every task was verified against typecheck, lint, tests and build. Almost nothing
was verified at *runtime* — there is no database, no Clerk instance, no Hume
config and no Gemini key on this machine. Each Asana task's closing comment
states precisely what was and was not verified for that task. Treat the runtime
behaviour of the two new features, and the billing webhook, as unproven.
