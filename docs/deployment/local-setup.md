# Local Setup Runbook

Prereqs → install → verify. Written from real first-run failures (2026-10-14).
Toolchain: **Bun for everything** (ADR-0006); Node only runs Next.js.

## Prerequisites

| Tool | Install | Verify |
|---|---|---|
| Node 20+ | `brew install node@20` (or nvm) | `node -v` |
| Bun 1.2+ | `curl -fsSL https://bun.sh/install \| bash` | `bun -v` |
| Docker (OrbStack or Docker Desktop) | `brew install orbstack` then **`open -a OrbStack`** | `docker info` |

## First run

```bash
cd saas-lab/finlab
cp .env.example .env       # local defaults work as-is (match compose creds)
bun install                # creates bun.lock — commit it
bun run typecheck && bun run test
docker compose up --build -d
bun scripts/smoke.ts       # expect 4/4 ✅
```

Note: **Bun auto-loads `.env`** in every process — no dotenv package, and edits to
`.env` require restarting the dev process (`--watch` doesn't re-read env files).

## Troubleshooting (observed failures)

| Symptom | Cause | Fix |
|---|---|---|
| `zsh: command not found: pnpm` | obsolete — pnpm retired (ADR-0006); use `bun` | `bun install` |
| `/ready` → `db=DOWN redis=up` | placeholder `.env` values in use (observed 2026-10-14) | re-copy `.env.example` (now has working local defaults), restart dev process |
| `unable to get image ... orbstack ... docker.sock` | OrbStack app not running | `open -a OrbStack`, wait, `docker info` |
| smoke 4/4 ❌ | nothing is running yet | run compose first; smoke only *verifies* |
| CI `--frozen-lockfile` fails | lockfile not committed | `bun install` locally, commit `bun.lock` |
| port already in use | stale containers | `docker compose down -v` then up again |

## Daily dev loop

```bash
docker compose up postgres redis -d   # infra only
bun run dev                           # turbo: web :3100, api :3001, worker :3002
```
