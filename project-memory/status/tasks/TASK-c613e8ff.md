---
id: TASK-c613e8ff
title: Phase 2c — better-auth invite-only wiring
status: review
claimed_by: architect-agent (cline)
branch: main (solo session; branch protocol activates with parallel agents)
owns:
  - apps/api/src/lib/auth.ts
  - apps/api/src/lib/tenancy.ts
  - apps/api/src/routes/auth.ts
  - apps/api/src/routes/auth.test.ts
  - apps/api/src/routes/invites.ts
  - apps/api/src/routes/scoped.ts
  - apps/api/src/scripts/**
  - apps/api/src/server.ts (mounts only)
  - apps/api/package.json (auth deps)
  - apps/web/app/**
  - apps/web/lib/**
  - apps/web/package.json (auth dep)
  - packages/db/package.json (./schema export only)
  - docker-compose.yml (auth env only)
  - .env.example (auth section only)
  - .env (local-only; gitignored)
depends_on: [TASK-52a79ed9]
verify:
  - bun run typecheck
  - bun run test (auth integration incl. cross-tenant isolation)
  - dev-admin bootstrap + manual curl end-to-end (sign-in, invite, scoped reads)
  - docker compose up --build -d (api+web) && smoke 4/4 && web login loads
created: 2026-10-16T22:30:00Z
---

## Scope

Per ADR-0005 + mvp-scope tenancy/auth section. Decisions (founder question
timed out 2026-10-16 — recommended defaults taken, REVIEWABLE):

1. **Custom `memberships`** (ADR-0005 roles owner/admin/member/viewer; already
   in schema) — NOT better-auth's organization plugin (would need new ADR +
   plugin tables + different role model).
2. **Google OAuth env-gated**: wired into config but enabled only when
   GOOGLE_CLIENT_ID/SECRET are set; email/password works now.
3. **Minimal web UI**: /login page + /dashboard (monitors + incidents of the
   user's tenants) — enough for the Phase 2 "synthetic provider demo".

Implementation: better-auth core + drizzle adapter + bearer plugin; public
sign-up blocked at the HTTP layer (route guard, tested) so server-side user
creation (invite flow) still works; invite = owner/admin only, creates user
via auth.api.signUpEmail + membership + console-log email adapter (dev);
temp password revealed in response ONLY in local/test. Session-scoped read
routes (/api/me, /api/monitors, /api/incidents) enforce tenant isolation via
memberships (threat-model cross-tenant attack tested).

## Expected outputs

- Auth integration tests green: sign-up blocked, sign-in works, invite flow,
  RBAC (viewer can't invite), cross-tenant isolation, 401 unauthenticated.
- dev founder bootstrap script (`seed:admin`).
- Web login + dashboard pages working against dockerized api.

## Summary of changes

- `apps/api/src/lib/auth.ts`: better-auth (core + drizzle adapter + bearer
  plugin) over the SHARED getDb() pool; session 7d/rotate-daily; public
  sign-up NOT disabled via better-auth's flag (would block server-side
  invite creation) — blocked at the HTTP layer instead; Google OAuth
  env-gated (present in config only when GOOGLE_CLIENT_ID/SECRET set).
- `apps/api/src/lib/tenancy.ts`: getSessionUser / listMemberships /
  visibleTenantIds / membershipIn (RBAC) — the app-layer tenant scoping
  every read goes through (OQ-01 keeps RLS at Phase 9).
- `apps/api/src/routes/auth.ts`: /api/auth/* handler mount + the sign-up
  guard (403, tested). `routes/invites.ts`: POST /api/invites — owner/admin
  only; creates the user via auth.api.signUpEmail (proper hashing) +
  membership + audit_log + console-log email adapter; temp password echoed
  in response ONLY when env.isLocal. `routes/scoped.ts`: GET /api/me,
  /api/monitors, /api/incidents — session + membership-scoped, CORS
  preflight/headers for the web origin.
- `apps/api/src/scripts/dev-admin.ts` (+ package script `seed:admin`):
  local/test-only bootstrap of the first owner on `dev-financial`
  (invite-only's chicken/egg breaker). Idempotent.
- `apps/web`: `lib/auth-client.ts` (better-auth browser client),
  `app/login/page.tsx`, `app/dashboard/page.tsx` (monitors + recent
  incidents, membership-scoped), home page nav update.
- Plumbing: `@wirewatch/db` gained `./schema` subpath export (adapter needs
  the bare table map); BETTER_AUTH_URL corrected to the API origin
  (3001) in .env/.env.example/compose; BETTER_AUTH_SECRET generated in
  local .env; compose passes auth env to the api service.
- Housekeeping: retired `pnpm-workspace.yaml` deleted (ADR-0006 follow-up
  from the 2a session).

## Verification

**Level: `tested-locally`** — all executed 2026-10-16/17.

- `bun run typecheck` — 4/4 packages · `bun run test` — **40 pass, 0 fail,
  0 skip** (21 api: 10 ingestion integration + 8 auth integration incl.
  cross-tenant isolation + RBAC + sign-up-blocked + pure classify; 13 db;
  6 simulator)
- Test-file fix discovered live: `afterAll shutdownDeps()` ends the shared
  pool for every later test file in the same run → removed (documented
  in both test files)
- `seed:admin`: idempotent, exits cleanly (initially hung — auth had its
  own pool; now shares the getDb() singleton)
- Docker stack rebuilt (api+worker+web) — smoke **4/4**; web pages
  `/login` `/dashboard` `/` all 200
- End-to-end against the dockerized API (curl):
  public sign-up **403** · founder sign-in **200** · `/api/me` owner
  membership · `/api/monitors` = exactly the 3 seeded monitors · wrong
  password **401** · CORS preflight **204** + correct headers · invite →
  **201** + teammate sign-in with temp password **200** + `/api/me`
  viewer membership · viewer tries to invite → **403** (RBAC live)

Not done: Google OAuth needs founder-created credentials (env-gated,
activates when set); Resend email adapter (console-log adapter now);
staging deploy (accounts); `tested-in-deploy` level not reached.

