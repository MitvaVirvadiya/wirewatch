---
id: TASK-c613e8ff
title: Phase 2c — better-auth invite-only wiring
status: claimed
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

(filled on completion)

## Verification

(filled on completion)
