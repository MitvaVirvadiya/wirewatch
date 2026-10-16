# Learning Notes — index

One file per concept, written **when the feature is implemented** (not before),
each following the 9-phase workflow from the brief: problem → concepts →
alternatives → design → implementation → verification → observation → review →
learning checkpoint questions.

| # | Concept | Lands in phase | File |
|---|---|---|---|
| L01 | Idempotency keys, unique constraints, exactly-once *effects* vs at-least-once delivery | 3 | `L01-idempotent-ingestion.md` |
| L02 | Isolation levels & row locking in ingestion race conditions | 3 | `L02-isolation-and-locking.md` |
| L03 | Queue delivery guarantees, retries, DLQ, backpressure | 4 | `L03-queues-and-retries.md` |
| L04 | Fingerprinting & dedupe (grouping 1000 failures → 1 incident) | 4 | `L04-fingerprinting.md` |
| L05 | Structured logs, correlation IDs, p50/p95/p99, what to alert on | 5 | `L05-observability.md` |
| L06 | WebSocket presence, optimistic UI, conflict handling on incidents | 6 | `L06-realtime.md` |
| L07 | Deterministic bucketing, config caching, stale-config behavior, shadow evaluation | 7 | `L07-feature-flags.md` |
| L08 | Tenant isolation models, RBAC, webhook idempotency (Stripe) | 2/8 | `L08-tenancy-and-billing.md` |

Checkpoint discipline: each file ends with 5 questions the founder answers
in writing (or out loud to an agent) before the phase is considered complete.
