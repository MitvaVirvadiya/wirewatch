# Wirewatch (working name — see `research/market/001-naming.md`)

**Finance-aware reliability monitoring for the providers your fintech depends on.**

When a broker feed arrives late, a webhook fires twice, a provider's schema drifts,
or a balance goes stale — generic uptime tools say nothing, and you find out from
a customer. Wirewatch detects, classifies, groups, and escalates *financial*
integration failures, and gives your team a shared, real-time workspace to
investigate them.

> Born from founder experience: this problem was lived, not imagined
> (see `research/problem-validation/001-founder-context.md`).

## Status

🟡 **Phase 0/1 — Discovery documented, architecture approved, no application code yet.**
See [`STATUS.md`](./STATUS.md) for the live picture and the next task.

## Stack (locked — ADR-0002…0005)

TypeScript · Next.js 15 (web) · Bun + Elysia (api + worker, **modular monolith**)
PostgreSQL (Neon) + **Drizzle** · Redis (Upstash) · better-auth · Stripe **test mode only**
Deploy: Vercel (web) + Railway (api/worker) → later: self-hosted VPS (DevOps phase)

## For humans

1. Read `docs/product/vision.md` then `docs/product/mvp-scope.md`
2. Skim `docs/architecture/overview.md`
3. `research/market/000-discovery-report.md` explains *why this product*

## For AI agents 🤖

**Stop. Read in this order before doing anything:**
0. `project-memory/HANDOFF.md` ← current snapshot + immediate next task
1. `project-memory/coordination-protocol.md` ← the rules of work
2. `PROJECT_CONTEXT.md` ← stable truths
3. `STATUS.md` → `project-memory/status/tasks/` ← what's claimed, what's next
4. ADRs in `docs/decisions/` relevant to your task

## Documentation index

| Area | Location |
|---|---|
| Product research & competitors | `research/` |
| Product scope & vision | `docs/product/` |
| Architecture & ADRs | `docs/architecture/`, `docs/decisions/` |
| Engineering learning notes | `docs/learning/` |
| Experiments (load, failure injection) | `experiments/` |
| Deployment & runbook | `docs/deployment/` |
| Security & threat model | `docs/security/` |
| Agent memory & task records | `project-memory/` |
