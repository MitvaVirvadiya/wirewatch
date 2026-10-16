# STATUS.md — Live Project State

**Current phase:** 0/1 — Foundations (docs & environment). **No application code exists yet.**

Verification levels used below: `implemented | tested-locally | tested-in-deploy | verified-under-load`

## Done

- [x] Discovery research & direction selection (Direction 2) — see `research/market/000-discovery-report.md` — *verified via research + founder experience*
- [x] Architecture decisions ADR-0001…0005 — *documented*
- [x] Multi-agent coordination protocol — *documented*
- [x] Workspace skeleton (this structure) — *implemented*
- [x] TASK-f01a2b3c Phase 1 toolchain code (api+worker+web shells, Docker, CI) — **implemented, NOT tested-locally (no shell)** — awaiting human `bun install`
- [x] ADR-0006: package manager switched pnpm → **Bun** (founder ruling 2026-10-14); Dockerfiles/CI/docs updated

## In progress / Next (claim via protocol)

| Order | Task file | Summary |
|---|---|---|
| 1 | `tasks/TASK-f01a2b3c.md` | **review**: human env fixes in progress — pnpm no longer needed (ADR-0006); just `bun install` + start OrbStack. Runbook: `docs/deployment/local-setup.md` |
| 2 | *to be created* | Phase 2a: `@wirewatch/db` schema (tenants/users/monitors/events/incidents) + Drizzle migrations |
| 3 | *to be created* | Phase 2b: synthetic provider simulator v1 + ingestion spike against a hardcoded dev tenant |
| 4 | *to be created* | Phase 2c: better-auth invite-only wiring (ADR-0005) — **reordered after simulator** (founder approved; pipeline learning front-loaded, tenancy already enforced by schema) |

Note: accounts/env setup deferred by founder — develop local-first, `.env` filled later.

## Phase gate status

| Phase | Gate (acceptance criteria) | Status |
|---|---|---|
| 0 Discovery | Direction chosen, competitors documented, demand evidence recorded | ✅ passed (founder experience; formal interviews waived per D7) |
| 1 Foundations | `pnpm dev` boots web+api+worker; Docker compose local; CI green; deploy pipeline to staging live | ⬜ |
| 2 Vertical slice | Auth (invite-only) + tenants + one monitor type + synthetic provider demo, deployed | ⬜ |
| 3 Reliable ingestion | Idempotent webhook intake; `experiments/concurrency/` proves dedupe under concurrency | ⬜ |
| 4 Background pipeline | Queues, retries, DLQ, classification, alert-once | ⬜ |
| 5 Observability | Failure-injection suite green; dashboards; metrics defined | ⬜ |
| 6 Realtime investigations | Presence + live comments on incidents | ⬜ |
| 7 Flags | Detection rules behind flags w/ shadow evaluation + rollback drill | ⬜ |
| 8 Billing | Usage metering + Stripe test subscription lifecycle | ⬜ |
| 9 Hardening | Security review, load test, runbook, **self-host VPS migration (DevOps learning)** | ⬜ |

## Blockers

- None currently. Accounts (Neon/Upstash/Sentry/Railway/Vercel/Stripe-test) must be created by the human.

## Notes

- Shell execution was unavailable to agents during scaffolding — verify `pnpm install` first.
- `finlab/` lives inside `saas-lab/` (parent remains the concepts playground).
- Founder to-do: fill `research/problem-validation/001-founder-context.md`; confirm/veto name "Wirewatch"; create accounts (Neon, Upstash, Sentry, Railway, Vercel, Stripe test); set spend alerts (D8).
