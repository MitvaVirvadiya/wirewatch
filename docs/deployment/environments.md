# Environments & Deployment (Architecture A — ADR-0003)

## Environments

| Env | Where | Data | Purpose |
|---|---|---|---|
| `local` | docker compose: postgres, redis, api, worker, web | seeded synthetic | dev + experiments |
| `staging` | Railway preview service + Neon branch + Vercel preview | seeded synthetic | PR validation |
| `production` | Railway + Neon main + Vercel prod | synthetic demo data | public demo |

`APP_ENV` gates: debug/seed endpoints (`local|test` only), log verbosity,
simulator endpoints, Stripe mode (`test` everywhere anyway — policy).

## Pipeline

1. PR → CI: install, lint, typecheck, build, unit tests, docker build
2. Merge to `main` → Vercel prod deploy (web) + Railway deploy (api, worker;
   release command runs `drizzle-kit migrate`)
3. Smoke: `scripts/smoke.ts` hits `/health` (liveness) + `/ready` (readiness:
   DB + Redis reachable) on every env and prints a table

## Health checks (distinct on purpose)

- `GET /health` — **liveness**: process is up. No dependency checks.
- `GET /ready` — **readiness**: can reach Postgres + Redis. Railway routes traffic
  on this; k8s-style separation is deliberate learning.

## Rollback

- Web: Vercel instant rollback to previous deployment.
- API/worker: Railway redeploy previous image; **DB migrations are expand-only**
  (additive) so rollbacks never fight schema. Destructive changes = two-phase
  (expand → deploy → contract) documented per migration.

## Backups & recovery

- Neon free: point-in-time within retention window; weekly `pg_dump` to local
  via `scripts/backup.sh` (lab-grade, honest about it).
- Redis (Upstash): treated as **rebuildable** — queues may lose in-flight jobs;
  ingestion is replayable from `events` table by design (the ledger is Postgres).

## Secrets

- Local: `.env` (gitignored). Staging/prod: Railway + Vercel env UI.
- Rotation runbook: `docs/deployment/runbook.md` (Phase 1 task).

## Phase 9 — Architecture B preview

Single VPS, Docker Compose: caddy (TLS) → web/api/worker + postgres + redis
with volume backups. Migration guide written as part of the exercise.
