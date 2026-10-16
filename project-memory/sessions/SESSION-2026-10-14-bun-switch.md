# SESSION 2026-10-14 — toolchain amendment (architect agent)

## Trigger

Founder ran the Phase 1 verification commands: `pnpm` not installed; OrbStack
daemon stopped; smoke 4/4 ❌ (expected — nothing was running). Founder asked
"why pnpm if I have Bun?" — correct instinct.

## What

- ADR-0006 written: Bun = runtime + package manager + workspaces + test runner.
  Node kept solely to run Next.js dev/build.
- Updated: root package.json (`workspaces` field, `packageManager: bun@1.2.0`),
  pnpm-workspace.yaml retired (comment stub), Dockerfile.api, Dockerfile.web
  (node image + global bun for install), CI (setup-bun + setup-node),
  local-setup.md runbook, PROJECT_CONTEXT, decisions mirror, STATUS, task file.

## Notes for future agents

- `workspace:*` protocol works in Bun workspaces — keep using it.
- `bun.lock` (text) must be committed; CI is `--frozen-lockfile`.
- Remaining env fix is on the human: start OrbStack (`open -a OrbStack`), then
  `bun install && bun run typecheck && bun run test && docker compose up --build -d
  && bun scripts/smoke.ts`.
