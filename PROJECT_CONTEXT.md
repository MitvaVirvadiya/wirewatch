# PROJECT_CONTEXT.md — Stable Truths

Curated, rarely edited. Only design tasks may modify this file (see coordination protocol).

## Product (ADR-0001)

**Direction 2: finance-aware provider reliability monitoring.** Chosen because the
founder lived this problem in brokerage/fintech work (primary demand evidence).
The domain model is deliberately designed so Direction 1 (reconciliation/exception
queues) and Direction 3 (ledger integrity) can be absorbed later — `events`,
`fingerprints`, and `exceptions` are generic enough to carry them.

## The five engineering capabilities → product features

| Capability | Product feature (genuine, not checklist) |
|---|---|
| A. Reliable event processing | Webhook/feed ingestion: idempotency keys, dedupe, unique constraints, exactly-once *effects* |
| B. Real-time collaboration | Live incident investigation: presence, live comments, assignment, activity feed |
| C. Error tracking & background jobs | Failure classification pipeline: queues, workers, retries, DLQ, grouping, alert-once |
| D. Feature flags | Detection/alerting rules rolled out per-tenant with shadow evaluation & instant rollback |
| E. Multi-tenancy & billing | Multiple fintech orgs, strict isolation, RBAC, usage metering, Stripe test billing |

## Hard constraints (non-negotiable)

- **Synthetic data only.** No real brokerage credentials, no real customer financial data, ever.
- **Stripe test mode only.** No live keys, no real payments.
- **Spend ceiling $10/mo hard cap, alerts at $4** (Railway/Vercel spend limits configured in Phase 1).
- Debug/seed/failure-injection endpoints: **localhost + CI only**, never reachable in production.
- Bun for everything: runtime, workspaces, test runner (ADR-0006). Node exists only to run Next.js dev/build. Turborepo orchestrates. Dockerize everything from day one (enables later VPS migration).

## Conventions

- Verification labels, used everywhere (tasks, STATUS, docs):
  `implemented` → `tested-locally` → `tested-in-deploy` → `verified-under-load`.
  Never claim a level not yet reached. Never invent test results.
- Every capability lands with: automated tests + a repeatable experiment in `experiments/`.
- Commits reference task IDs: `TASK-xxxxxxxx: message`.
- Auth model (ADR-0005): no public signup; admin-invited users; Google + email/password;
  access+refresh tokens; magic links for shared status views.
