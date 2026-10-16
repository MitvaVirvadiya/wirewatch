# HANDOFF.md — Read this first (future agents)

**Snapshot date:** 2026-10-14 · **Phase:** 1 of 9 · **Overall state:** skeleton built, toolchain verified locally, no product code yet.

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
| Phase 1 code (api/worker/web shells, Docker, CI) | **implemented → tested-locally pending final smoke** |
| `bun install`, `typecheck`, `test` | ✅ ran green on founder machine (one TS strictness bug in health.test.ts was found & fixed) |
| docker compose smoke | 🟡 3/4 green; 4th was placeholder `.env` DATABASE_URL — `.env.example` fixed with working local defaults; **awaiting founder's final 4/4 confirmation** |
| Anything deployed | ❌ nothing deployed yet |

## 4. Environment gotchas (learned the hard way, now in `docs/deployment/local-setup.md`)

- Agents in this setup may have **no shell** — create files, leave exact commands
  for the human, never claim execution you didn't see.
- OrbStack must be running (`open -a OrbStack`) or every docker command fails on the socket.
- **Bun auto-loads `.env` at process start; `--watch` does NOT re-read it** — restart after env edits.
- `.env.example` local defaults must *work*, not be plausible placeholders (db=DOWN incident).
- Commit `bun.lock`; CI uses `--frozen-lockfile`.

## 5. Immediate next task — Phase 2a: `@wirewatch/db`

Claim by creating `project-memory/status/tasks/TASK-<id>.md` per protocol.

Scope: `packages/db` — Drizzle schema + migrations for:
`tenants, users/sessions/memberships (better-auth compatible), monitors,
events (UNIQUE(monitor_id, provider_event_id) — the dedupe constraint),
incidents (UNIQUE(fingerprint) — grouping upsert target),
alerts (UNIQUE(incident_id) — alert-once), magic_links, audit_log`.
See `docs/architecture/overview.md` "Data model sketch" — it's the contract.

Rules: `tenant_id` on every tenant-owned table, FK + index; migrations are
**expand-only**; `drizzle-kit generate` output committed; add a seed script for
one dev tenant + 3 monitors. Wire `packages/db` into `apps/api/src/lib/deps.ts`
(replacing the raw `postgres` client is fine) and make `/ready` db check real
(remove the `isLocal` bypass once the package exists — keep bypass for `test`).

Then Phase 2b: `scripts/simulator/` v1 + ingestion endpoint spike (dev tenant),
then Phase 2c: better-auth wiring. Full gates in `STATUS.md`.

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
