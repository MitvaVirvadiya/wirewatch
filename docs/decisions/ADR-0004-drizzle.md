# ADR-0004 — Drizzle over Prisma

- Status: **accepted** (2026-10-14, founder ruling D5)

## Decision

Drizzle ORM + `drizzle-kit` migrations for all Postgres access.

## Rationale

Capability A (reliable ingestion) is the core learning objective. It requires
explicit control over: isolation levels, `SELECT … FOR UPDATE`, advisory locks,
and precise transaction boundaries. In Drizzle these are first-class SQL-level
calls; in Prisma they are partly hidden behind the engine or require `$transaction`
workarounds with interactive-transaction latency overhead. Since the *point* is
to learn and demonstrate these mechanics, the ORM must not abstract them away.

Additional: Drizzle is lighter in Bun (no query engine binary), simplifying
Docker images and Railway deploys.

## Consequences

- More SQL literacy demanded of agents — intentional, and recorded in `docs/learning/`.
- Schema lives in `packages/db/schema`, migrations versioned in git, migrate step
  runs in CI and as a Railway deploy command.
- Prisma remains acceptable for a future module if a concrete need appears
  (none known); would require a new ADR.
