# ADR-0006 — Bun as package manager (supersedes the pnpm assumption)

- Status: **accepted** (2026-10-14, founder ruling after first-run friction)
- Amends: ADR-0002 (toolchain detail), PROJECT_CONTEXT hard constraints

## Context

Phase 1 assumed pnpm workspaces. Founder's first command was
`zsh: command not found: pnpm` — while Bun was already installed and working.
Founder asked the right question: *"why pnpm if I have Bun?"*

## Decision

Bun does everything: runtime (api/worker), package manager (workspaces),
test runner (`bun test`), script runner. Node remains installed **only** as the
runtime for Next.js dev/build (`web` package). pnpm is removed from the toolchain.

## Rationale

- One tool, one mental model; `bun install` is the fastest option available.
- Bun workspaces support the `workspace:*` protocol; Turborepo detects Bun via
  `packageManager: "bun@…"` in root package.json.
- The phantom-dependency strictness pnpm provides is nice-to-have; at this scale,
  `tsc --noEmit` in CI covers the realistic risk. Re-adopt pnpm later is a
  one-commit change if the monorepo ever needs it.

## Consequences

- Root `package.json` declares `"workspaces"`; `pnpm-workspace.yaml` is retired.
- Lockfile is `bun.lock` (text format) — **must be committed**; CI uses
  `bun install --frozen-lockfile`.
- Docker: `Dockerfile.api` uses `oven/bun:1` directly; `Dockerfile.web` uses
  `node:20-alpine` + global bun for install, Node runs `next build/start`.
- Local prereq list shrinks to: Node 20+, Bun, OrbStack/Docker.
