# HANDOFF.md — Read this first (future agents)

**Snapshot date:** 2026-10-17 · **Phase:** 2 COMPLETE locally (a+b+c) — next: Phase 3 reliable ingestion · **Overall state:** full local vertical slice running (auth, tenants, signed ingestion, classification→incidents→alerts, web dashboard), 40 tests green, e2e demo verified against the dockerized stack, pushed to github.com/MitvaVirvadiya/wirewatch. **Nothing deployed yet** (staging blocked on founder accounts).

## 0. Mandatory read order (per `project-memory/coordination-protocol.md`)

1. `project-memory/coordination-protocol.md` — how work is claimed/recorded
2. `PROJECT_CONTEXT.md` — stable truths, hard constraints
3. `STATUS.md` — live state
4. ADRs in `docs/decisions/` touching your task
5. This file

## 1. What this project is

**Wirewatch**: a finance-aware reliability monitor for fintech provider
integrations — detects late files, schema drift, duplicate webhooks, stale
data, partial deliveries. Multi-tenant SaaS, synthetic data ONLY, Stripe
test mode ONLY. Learning vehicle for 5 capabilities (reliable ingestion,
realtime collab, background pipelines, feature flags, multi-tenancy+billing)
mapped to genuine product features — see `PROJECT_CONTEXT.md`.

## 2. What exists and works NOW (all `tested-locally`, evidence in task files)

- **Data layer** (`@wirewatch/db`): 13 tables, better-auth-compatible core,
  Capability-A uniques (events dedupe / incidents fingerprint / alerts
  incident_id), migrations 0000+0001 applied, `bun run db:seed` (1 tenant +
  3 monitors), `bun run db:studio` (https://local.drizzle.studio).
- **Auth** (`apps/api`, better-auth 1.7): invite-only — public sign-up 403
  (HTTP-layer guard); `POST /api/invites` (owner/admin, audited, console
  email adapter, temp password echoed local/test only); Google OAuth
  env-gated (set GOOGLE_CLIENT_ID/SECRET to activate); sessions + bearer
  plugin. First account bootstrap: `bun run --filter @wirewatch/api seed:admin`
  → founder@wirewatch.dev / founder-dev-password (dev default).
- **Signed ingestion** (`POST /api/ingest/:monitorId`): HMAC-SHA256 over raw
  body (`x-wirewatch-signature`, constant-time), idempotency key header
  (`x-provider-event-id`), `ON CONFLICT DO NOTHING` dedupe (202 either way,
  duplicates audited), classification spike (schema_drift / stale_data /
  late_file / partial_delivery), incident upsert (count+1), alert-once
  (console adapter), evidence links.
- **Simulator** (`bun run sim:run -- --mode clean|late|duplicate|drift|stale|partial`)
  — the demo driver; signs with INGEST_HMAC_SECRET (dev-ingest-secret locally).
- **Tenant-scoped reads**: `/api/me`, `/api/monitors`, `/api/incidents` —
  membership-scoped (`visibleTenantIds`), CORS for the web origin.
- **Web** (`apps/web`): `/login`, `/dashboard` (monitors + incidents),
  `/` with health + nav.
- **Stack**: `docker compose up --build -d` → postgres/redis/api/worker/web
  healthy; `bun scripts/smoke.ts` → 4/4; root scripts: `dev build typecheck
  test db:generate db:migrate db:seed db:studio sim:run smoke`.

## 3. Founder rulings (locked) + 2c defaults (REVIEWABLE)

D1–D10 + ADR-0001…0006 unchanged — see `docs/decisions/`. Phase 2c took
three **recommended defaults after the founder question timed out**
(documented in `sessions/SESSION-2026-10-16-phase2c-auth.md`):
custom `memberships` (no org plugin) · Google env-gated · minimal web UI.
Confirm or veto these when you next read this.

## 4. Verification state (honest labels)

| Item | Level |
|---|---|
| Phase 1 (toolchain, Docker, CI skeleton) | **tested-locally** (smoke 4/4) |
| Phase 2a `@wirewatch/db` | **tested-locally** — `status/tasks/TASK-123684e9.md` |
| Phase 2b simulator + ingestion | **tested-locally** — `status/tasks/TASK-52a79ed9.md` |
| Phase 2c better-auth | **tested-locally** — `status/tasks/TASK-c613e8ff.md` |
| Whole-workspace gate | `bun run typecheck` 4/4 · `bun run test` **40 pass / 0 fail / 0 skip** · e2e curl suite vs dockerized stack · smoke 4/4 |
| Anything deployed | ❌ nothing (staging = founder accounts: Neon, Upstash, Railway, Vercel, Sentry, Stripe-test) |

## 5. Environment gotchas (learned the hard way — all proven live)

- Bun auto-loads `.env` at process start; **turbo/test runs from a package
  cwd do NOT see the root .env** → package `test`/`seed:admin` scripts
  default `DATABASE_URL` inline (harmless; tests skip fast if no DB listens).
- **Test files share module state in one `bun test` run** — never call
  `shutdownDeps()` in a test file's `afterAll` (it ends the shared pool and
  silently skips every later DB test file).
- **One db pool**: better-auth's adapter uses the `getDb()` singleton —
  a second `createDb()` anywhere = an unclosed pool = hanging scripts.
- Bun filter syntax: `bun run --filter @wirewatch/pkg script`.
- Dockerfile.api must COPY every workspace package manifest before install.
- Docker build can fail transiently with macOS `Keychain Error -25320`
  (headless cred helper) — plain `docker pull` clears it; fallback:
  `DOCKER_CONFIG=$(mktemp -d) docker …`.
- Elysia `set.headers` is HTTPHeaders — assign CORS via
  `Object.assign(set.headers, corsHeaders())`.
- `BETTER_AUTH_URL` = the API origin (:3001), NOT the web app.
- Migrations are expand-only; `drizzle-kit generate` output committed.
- Commits reference task IDs; repo = `github.com/MitvaVirvadiya/wirewatch` (SSH, main).

## 6. Immediate next task — Phase 3: reliable ingestion (Capability A proper)

Claim by creating `project-memory/status/tasks/TASK-<id>.md` per protocol.
Scope (see `STATUS.md` gate + `docs/learning/L01/L02`):

- Move the **classification spike off the request path** onto the
  queue/worker (Phase 4 queues can start here or stay 4 — decide with founder).
- Idempotency-key design write-up (`docs/learning/L01-idempotent-ingestion.md`).
- **Per-monitor secret storage decision** (2b open question): HMAC can't be
  verified against a one-way hash — either encrypted (reversible) per-monitor
  secrets or shared/tenant secrets; needs founder input.
- `experiments/concurrency/`: prove dedupe under concurrency (parallel
  duplicate deliveries → exactly one event row; grouping upsert under races).
- Stripe-style signature scheme (timestamp + scheme prefix) worth adopting
  for replay hardening.

Before Phase 3 is "done": founder answers the L08 checkpoint questions
(`docs/learning/L08-tenancy-and-billing.md`, 8 questions) — Phase 2 sign-off.

## 7. Learning-workflow obligation (the whole point)

Every substantial feature follows the 9-phase workflow and ends with a
`docs/learning/L0x` note + checkpoint questions. Labels:
`implemented → tested-locally → tested-in-deploy → verified-under-load`.
Never inflate. L08 (tenancy) is written; L01/L02 land with Phase 3.

## 8. Open questions (don't resolve silently)

- OQ-01 Postgres RLS timing (Phase 9) · OQ-02 magic-link single vs multi-use
- 2c defaults (custom memberships / env-gated Google / minimal UI) — founder confirm/veto
- Google OAuth: founder creates the OAuth app + sets GOOGLE_CLIENT_ID/SECRET
- Per-monitor ingest secret storage (Phase 3, needs founder input)
- Resend (or other) email adapter timing
- CI: no Postgres service yet → integration tests skip in CI (compose smoke covers happy path)
- Domain/handle availability for "Wirewatch" before public demo
- Founder to fill `research/problem-validation/001-founder-context.md` (star story)
- Founder accounts to create (staging deploy): Neon, Upstash, Railway, Vercel, Sentry, Stripe-test; spend alerts at $4, cap $10 (D8)
