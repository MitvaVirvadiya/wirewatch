# ADR-0002 — Modular monolith: one Elysia codebase, three processes

- Status: **accepted** (2026-10-14, founder ruling D4)
- References: brief §9; `docs/architecture/overview.md`

## Decision

One repository (pnpm + Turborepo), one Elysia codebase in `apps/api` with **two
process entrypoints** (`server.ts` HTTP, `worker.ts` queue consumer), plus
`apps/web` (Next.js). Modules inside `packages/domain` enforce boundaries:
`ingestion/`, `classification/`, `incidents/`, `alerting/`, `tenancy/`, `flags/`,
`billing/`. No microservices, no separate repos.

## Rationale

- The failure modes worth learning (queues, retries, DLQ, transactions) exist
  **inside** a monolith; network partitions between own services add cost, not learning.
- One DB, one deploy unit, one mental model — the right scale for 0 users → MVP.
- Process separation (api vs worker) is real: it teaches backpressure and lets
  Railway scale/restart them independently.

## Consequences

- Module boundaries enforced by lint rule (no cross-module imports except via
  each module's `index.ts`) — discipline replaces network isolation.
- Splitting a module into a service later = extract `packages/domain/<mod>` behind
  its existing interface. Cheap because boundaries were kept.
- WebSocket (Phase 6) runs in the api process; if it ever contends with ingestion,
  extraction is the documented escape hatch.

## Alternatives rejected

- Microservices now: deployment/observability overhead before any measured bottleneck.
- Next.js API routes for everything: contradicts the Elysia learning objective and
  worker model.
