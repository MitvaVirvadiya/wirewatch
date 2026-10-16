---
id: TASK-f01a2b3c
title: Phase 1 — monorepo toolchain, Docker, CI skeleton
status: review
claimed_by: architect-agent (cline)
branch: main (solo session; branch protocol activates with parallel agents)
owns:
  - package.json
  - pnpm-workspace.yaml
  - turbo.json
  - .env.example
  - docker-compose.yml
  - Dockerfile.api
  - apps/web/**
  - apps/api/**
  - apps/worker/**
  - packages/config/**
  - .github/workflows/ci.yml
depends_on: []
verify:
  - pnpm install
  - pnpm typecheck
  - pnpm build
  - docker compose up --build (web+api+worker healthy)
created: 2026-10-14T00:00:00Z
---

## Scope

Bootstrap the deployable skeleton: Next.js web, Elysia api, Elysia worker entrypoint
(same codebase, two process entries per ADR-0002), shared tsconfig package, Docker
compose for local (postgres+redis+services), GitHub Actions CI (install/lint/typecheck/build).
No product features. Hello-world endpoints only: `GET /health` on api and worker.

## Expected outputs

- `pnpm dev` runs web+api+worker via turbo
- `docker compose up` reproduces the environment
- CI green on an empty-diff PR
- `apps/api` serves `GET /health` → `{ ok: true }`

## Summary of changes

- `packages/config`: tsconfig.base.json (strict, bundler resolution) + package export
- `apps/api` (@wirewatch/api): `src/env.ts` (typed env + APP_ENV debug gate),
  `src/lib/deps.ts` (lazy pg/redis clients + timeout probes + graceful shutdown),
  `src/routes/health.ts` (**/health liveness vs /ready readiness — separate on purpose**),
  `src/server.ts`, `src/worker.ts` (heartbeat loop, health on :3002),
  `src/routes/health.test.ts` (bun:test contract test)
- `apps/web` (@wirewatch/web): Next.js 15 shell; homepage renders API /health
  server-side to prove web→api connectivity
- Root: `Dockerfile.api` (one image, two CMDs), `Dockerfile.web`,
  `docker-compose.yml` (postgres+redis+api+worker+web with healthchecks),
  `.dockerignore`, `.github/workflows/ci.yml` (lint/typecheck/build/test +
  gitleaks + compose smoke), `scripts/smoke.ts`
- Deviation from original owns-list: no separate `apps/worker` package — worker is
  a second entrypoint in `apps/api` per ADR-0002; `apps/README.md` updated.
- Mid-task amendment (founder ruling): package manager pnpm → **Bun** (ADR-0006).
  Root package.json now declares `workspaces`; `pnpm-workspace.yaml` retired;
  Dockerfiles + CI + runbook updated.

## Verification

**Level: `implemented` — NOT executed.** Shell access was unavailable in the
agent environment, so nothing here has been run. Honest risks:

- `pnpm install` not yet run → lockfile doesn't exist; CI uses `--frozen-lockfile`,
  which will fail until lockfile is committed (run `pnpm install` first).
- Elysia/bun:test APIs written from convention, not execution — small API drift
  possible (e.g. `app.handle()` signature, `bun-types` version).
- docker-compose healthchecks use inline `bun -e` fetch — untested.

**Human verification steps (updated for ADR-0006):**
1. `cd saas-lab/finlab && bun install` (creates `bun.lock` — commit it)
2. `bun run typecheck && bun run test`
3. `open -a OrbStack` → `docker compose up --build -d` → `bun scripts/smoke.ts`
4. If green: commit; mark this task `done`, verification `tested-locally`.
