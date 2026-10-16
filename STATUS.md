# STATUS.md — Live Project State

**Current phase:** 2a — Vertical slice. Phase 1 confirmed green locally 2026-10-16 (smoke 4/4); data layer (`@wirewatch/db`) landed, tested-locally.

Verification levels used below: `implemented | tested-locally | tested-in-deploy | verified-under-load`

## Done

- [x] Discovery research & direction selection (Direction 2) — see `research/market/000-discovery-report.md` — *verified via research + founder experience*
- [x] Architecture decisions ADR-0001…0005 — *documented*
- [x] Multi-agent coordination protocol — *documented*
- [x] Workspace skeleton (this structure) — *implemented*
- [x] TASK-f01a2b3c Phase 1 toolchain (api+worker+web shells, Docker, CI) — **tested-locally confirmed 2026-10-16**: `bun install`/`typecheck`/`test` green, docker compose smoke **4/4 healthy**, `/ready` db+redis true
- [x] ADR-0006: package manager switched pnpm → **Bun** (founder ruling 2026-10-14); Dockerfiles/CI/docs updated
- [x] TASK-123684e9 Phase 2a `@wirewatch/db` (Drizzle schema, committed migrations, seed, api wiring, real `/ready` db check) — **tested-locally** — see `project-memory/status/tasks/TASK-123684e9.md`
- [x] TASK-52a79ed9 Phase 2b simulator + signed ingestion (HMAC, dedupe, classification spike, incidents, alert-once) — **tested-locally** — see `project-memory/status/tasks/TASK-52a79ed9.md`

## In progress / Next (claim via protocol)

| Order | Task file | Summary |
|---|---|---|
| 1 | `tasks/TASK-52a79ed9.md` | **review**: Phase 2b complete — 37 tests green, full 6-mode demo verified against dockerized API |
| 2 | `tasks/` (2c, to be created) | Phase 2c: better-auth invite-only wiring (ADR-0005) — open question to founder before start: custom `memberships` vs better-auth organization plugin; Google OAuth now or env-gated later; web login page scope |

Note: accounts/env setup deferred by founder — develop local-first, `.env` filled later.

## Phase gate status

| Phase | Gate (acceptance criteria) | Status |
|---|---|---|
| 0 Discovery | Direction chosen, competitors documented, demand evidence recorded | ✅ passed (founder experience; formal interviews waived per D7) |
| 1 Foundations | `bun dev` boots web+api+worker; Docker compose local; CI green; deploy pipeline to staging live | 🟡 local green (smoke 4/4 on 2026-10-16); staging deploy pending (accounts needed) |
| 2 Vertical slice | Auth (invite-only) + tenants + one monitor type + synthetic provider demo, deployed | 🟡 2a data layer + 2b simulator/ingestion done (`tested-locally`); 2c auth remaining; staging deploy pending (accounts needed) |
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

- Agents DO have shell in the current Cline environment (verified 2026-10-16 — all Phase 2a verification was executed directly). The Phase-1-era "no shell" limitation no longer applies.
- Git repo initialized 2026-10-16 at Phase 2a start (retroactive Phase 1 baseline commit + task commits per protocol).
- `finlab/` lives inside `saas-lab/` (parent remains the concepts playground).
- Founder to-do: fill `research/problem-validation/001-founder-context.md`; confirm/veto name "Wirewatch"; create accounts (Neon, Upstash, Sentry, Railway, Vercel, Stripe test); set spend alerts (D8).
- Cleanup candidate: `pnpm-workspace.yaml` is retired (ADR-0006) but still on disk — remove in the next housekeeping commit.
