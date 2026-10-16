# HANDOFF.md — Read this first (future agents)

**Snapshot date:** 2026-10-16 · **Phase:** 2a done (data layer) — next: 2b simulator/ingestion spike · **Overall state:** Phase 1 confirmed green locally (smoke 4/4); `@wirewatch/db` landed (schema+migrations+seed, tested-locally); git repo initialized; nothing deployed yet.

## 0. Mandatory read order (per `project-memory/coordination-protocol.md`)

1. `project-memory/coordination-protocol.md` — how work is claimed/recorded
2. `PROJECT_CONTEXT.md` — stable truths, hard constraints
3. `STATUS.md` — live state
4. ADRs in `docs/decisions/` touching your task
5. This file

## 1. What this project is

**Wirewatch** (name confirmed by founder): a finance-aware reliability monitor for
fintech provider integrations — detects late files, schema drift, duplicate webhooks,
stale data, partial deliveries. Multi-tenant SaaS, synthetic data ONLY, Stripe test
mode ONLY. It is a learning vehicle for 5 capabilities (reliable ingestion, realtime
collab, background pipelines, feature flags, multi-tenancy+billing) that must map to
genuine product features — see `PROJECT_CONTEXT.md` mapping table.

Long-term: domain model is deliberately generic enough to absorb reconciliation
(Direction 1) and ledger (Direction 3) features later. Don't break that.

## 2. Founder rulings (locked)

D1 Direction 2 (founder lived the problem) · D2 finlab lives inside saas-lab ·
D3 managed deploy first (Vercel+Railway+Neon+Upstash), self-host VPS as Phase 9
DevOps exercise · D4 modular monolith: one Elysia codebase, `server.ts` + `worker.ts`
entrypoints · D5 Drizzle (not Prisma) · D6 better-auth: invite-only, Google +
email/pass, multi-admin tenants, access+refresh tokens, scoped expiring magic links
for status sharing · D7 interviews waived (founder experience = demand evidence) ·
D8 spend cap $10/mo, alerts at $4 · D9 no real credentials/financial data ever ·
D10 name = Wirewatch ✅

ADRs 0001–0006 in `docs/decisions/`. **0006: Bun is the package manager too** —
pnpm is retired; Node exists only to run Next.js.

## 3. Verification state (honest labels)

| Item | Level |
|---|---|
| Docs/ADRs/protocol | documented |
| Phase 1 code (api/worker/web shells, Docker, CI) | **tested-locally — confirmed 2026-10-16** (bun install/typecheck/test green; docker compose smoke **4/4**; all services healthy) |
| Phase 2a `@wirewatch/db` (schema, migrations, seed, api wiring, real `/ready` db check) | **tested-locally** — see `status/tasks/TASK-123684e9.md` |
| Anything deployed | ❌ nothing deployed yet (staging blocked on founder accounts) |

## 4. Environment gotchas (learned the hard way, now in `docs/deployment/local-setup.md`)

- Agents in this setup DO have shell now (verified 2026-10-16) — but still never claim execution you didn't see.
- OrbStack must be running (`open -a OrbStack`) or every docker command fails on the socket.
- **Bun auto-loads `.env` at process start; `--watch` does NOT re-read it** — restart after env edits.
- `.env.example` local defaults must *work*, not be plausible placeholders (db=DOWN incident).
- Commit `bun.lock`; CI uses `--frozen-lockfile`.
- Bun workspace filter syntax is `bun run --filter @wirewatch/pkg script` (NOT `bun --filter pkg run script`).
- **Dockerfile.api must COPY every workspace package manifest before `bun install`** — a new workspace dep breaks the build until its package.json is copied (pruned-workspace error).
- Migrations are expand-only; `drizzle-kit generate` output is committed (`packages/db/drizzle/`).

## 5. Immediate next task — Phase 2b: provider simulator + ingestion spike

Claim by creating `project-memory/status/tasks/TASK-<id>.md` per protocol.

Scope: `scripts/simulator/` v1 — a synthetic provider that emits webhooks,
heartbeat files, and poll responses (good + deliberately broken: late,
schema-drift, duplicate, stale, partial). Then an ingestion endpoint spike:
`POST /api/ingest/...` against the **seeded** dev tenant (`dev-financial`,
3 monitors: `Daily NAV file drop` heartbeat, `Payments provider webhook`
webhook, `FX rates poll` poll). Use `monitors.contract_schema`/`sanity` as
the classification input; verify HMAC via `monitors.ingest_secret_hash`
(hash per-monitor secret; `INGEST_HMAC_SECRET` env fallback). Dedupe:
`INSERT ... ON CONFLICT (monitor_id, provider_event_id) DO NOTHING` on
`events` — 202 either way. Simulator mounts ONLY behind
`debugEndpointsAllowed()` (local/test).

Then Phase 2c: better-auth wiring — schema is already core-compatible
(`user/session/account/verification` in `packages/db/src/schema/auth.ts`);
decide custom `memberships` vs better-auth organization plugin (open
question in `sessions/SESSION-2026-10-16-phase2a-db.md`). Full gates in
`STATUS.md`.

## 6. Learning-workflow obligation (the whole point)

Every substantial feature follows the 9-phase workflow (brief §12) and ends with
a `docs/learning/L0x` note + checkpoint questions. Verification labels:
`implemented → tested-locally → tested-in-deploy → verified-under-load`.
Never inflate. If you couldn't run it, say so and say why.

## 7. Open questions (don't resolve silently)

- OQ-01: Postgres RLS timing (currently Phase 9; app-layer scoping + tests until then)
- OQ-02: magic-link single-use vs multi-use-until-expiry (current: multi-use, read-only, audited)
- Domain/handle availability for "Wirewatch" — Phase 2 to-do before public demo
- Founder to fill `research/problem-validation/001-founder-context.md` (star story)
