# SESSION — 2026-10-16/17 — Phase 2c: better-auth invite-only (architect-agent, cline)

## What was done

TASK-c613e8ff: better-auth (core + drizzle adapter + bearer plugin) on the
shared getDb() pool; public sign-up blocked at the HTTP layer; custom invite
flow (POST /api/invites, owner/admin only, server-side signUpEmail + membership
+ audit + console email adapter, temp password echoed local/test only);
session-scoped reads (/api/me, /api/monitors, /api/incidents) with CORS;
dev-admin bootstrap; web login + minimal dashboard. 40 tests green; full e2e
verified against the dockerized stack; smoke 4/4.

## Why these choices (founder question timed out → recommended defaults, REVIEWABLE)

1. Custom `memberships` over better-auth organization plugin — ADR-0005's
   role set already in schema; plugin would need new ADR + its own tables.
2. Google OAuth env-gated — activates the moment GOOGLE_CLIENT_ID/SECRET are
   set; email/password works now; no founder action blocked the phase.
3. Sign-up blocked at HTTP layer (route guard) instead of better-auth's
   `disableSignUp` — the flag also blocks auth.api.signUpEmail, which the
   invite flow needs server-side. Guard is single-place and tested.
4. Minimal web UI (login + dashboard) — Phase 2 gate wants a demo-able slice;
   the realtime investigation UI is Phase 6.

## Surprises (learned the hard way)

1. **Test files share module state in one `bun test` run**: ingest.test.ts's
   `afterAll shutdownDeps()` ended the shared pool → auth.test.ts's probe
   failed → tests silently SKIPPED. Fix: no teardown in test files (documented
   in both). Lesson: skips in shared-process suites deserve investigation.
2. **Two pools**: auth initially built its own createDb() → seed:admin hung
   on the unclosed pool at exit. Fix: share the getDb() singleton.
3. better-auth's generic options type fights `ReturnType<typeof betterAuth>`
   — fixed by extracting `buildAuth()` so the inferred concrete type flows.
4. Elysia `set.headers` is HTTPHeaders, not a plain Record — assign CORS
   headers with `Object.assign(set.headers, corsHeaders())`.
5. BETTER_AUTH_URL must be the API ORIGIN (where /api/auth/* lives), not the
   web app URL — .env/.env.example/compose corrected to :3001.

## Open questions

- Google OAuth: founder to create the OAuth app + set GOOGLE_CLIENT_ID/SECRET
  (activates automatically). Also confirm/veto the three default decisions
  above (especially: temp password in local responses — acceptable for dev?).
- Resend (or similar) email adapter timing — console-log adapter until then.
- Active-tenant context in session (ADR-0005: user in multiple tenants) —
  dashboard shows all tenants' rows for now; explicit switcher is Phase 6+ UI work.
- CI still has no Postgres service for integration tests (they skip in CI;
  compose smoke covers the happy path).
