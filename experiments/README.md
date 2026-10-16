# Experiments

Repeatable, documented, bounded. Format per experiment (`EXP-NNN-slug.md`):
hypothesis · environment · exact commands · measurements · results (real output
only) · conclusion · limitations. Cite the TASK id that built what you're testing.

## Planned (by phase)

| ID | Area | Proves | Safeguards |
|---|---|---|---|
| EXP-001 | `concurrency/` | N concurrent duplicate webhook deliveries → exactly 1 stored event per `provider_event_id` | local + staging only |
| EXP-002 | `ingestion/` | Retries with same idempotency key → single effect; p95 ingest latency <100ms | rate-limited script |
| EXP-003 | `ingestion/` | 1,000 duplicate failure events → 1 incident, count=1000, **1 alert** | email adapter = console in non-prod |
| EXP-004 | `observability/` | Failure injection: malformed payload, DB kill, worker crash, queue backlog → all visible & recoverable | bounded loop counts |
| EXP-005 | `feature-flags/` | Rule rollout % matches distribution ±2%; rollback propagates <5s; flag-service-down → safe default | staging |
| EXP-006 | `tenancy/` | Automated cross-tenant access attempts (API + worker paths) → all denied | CI + staging |

Load-test rules (D8/cost safety): scripts carry `--max-requests` + `--max-duration`
defaults; never run against third parties; production = smoke tests only.
