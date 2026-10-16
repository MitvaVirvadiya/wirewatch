# Architecture Overview (target state, phases marked)

## System context

```
                 ┌────────────────────────────────────────────┐
 synthetic       │              Wirewatch                     │
 provider        │                                            │
 simulator ─────▶│  apps/api (Elysia, Bun)                    │
 (scripts/)      │   ├─ /api/ingest/:tenant/:monitor (signed) │──┐
   webhooks,     │   ├─ heartbeat evaluator (cron)            │  │ enqueue
   files, polls  │   ├─ auth (better-auth, ADR-0005)          │  ▼
                 │   └─ tenancy + RBAC middleware             │ Upstash Redis
 users ─────────▶│  apps/web (Next.js 15)                     │  (queues, cache)
   dashboard     │                                            │  │
                 │  apps/worker (Elysia/Bun, same codebase)   │◀─┘
                 │   └─ classify → fingerprint → group → alert│
                 │                                            │
                 │  Postgres (Neon, Drizzle)                  │
                 └────────────────────────────────────────────┘
                       │                        │
                   Sentry (errors)        Stripe TEST (Phase 8)
```

## Processes (ADR-0002: modular monolith, 3 processes)

| Process | Entry | Responsibility |
|---|---|---|
| web | `apps/web` | Dashboard, monitor config, incident UI, magic-link status pages |
| api | `apps/api/src/server.ts` | REST + ingestion endpoints + auth + tenancy |
| worker | `apps/api/src/worker.ts` | Queue consumers: classify, group, alert; heartbeat evaluation cron |

## Data model sketch (MVP — packages/db/schema)

```
tenants(id, name, plan, created_at)
users / sessions / memberships(tenant_id, user_id, role)      ← better-auth + role
monitors(id, tenant_id, type: heartbeat|webhook|poll,
         schedule, grace_sec, contract_schema jsonb, sanity jsonb, status)
events(id, tenant_id, monitor_id, provider_event_id, payload jsonb,
       received_at, UNIQUE(monitor_id, provider_event_id))     ← dedupe constraint
incidents(id, tenant_id, fingerprint, monitor_id, failure_type,
          status, first_seen, last_seen, occurrence_count, evidence jsonb)
incident_events(incident_id, event_id)                         ← evidence links
alerts(id, incident_id UNIQUE, channel, sent_at)               ← alert-once
magic_links(id, token_hash, tenant_id, resource_type, resource_id,
            expires_at, revoked_at, created_by)
audit_log(id, tenant_id, actor, action, before jsonb, after jsonb, at)
```

Key constraints that carry Capability A: `UNIQUE(monitor_id, provider_event_id)`
(ingestion dedupe), `UNIQUE(fingerprint)` on incidents (grouping via upsert),
`UNIQUE(incident_id)` on alerts (alert-once). These are explained in
`docs/learning/` when implemented.

## Data flow — one webhook's life

1. `POST /api/ingest/:monitorId` — verify signature, check idempotency key,
   `INSERT … ON CONFLICT DO NOTHING` into `events` (202 either way; duplicate flagged).
2. Enqueue `classify` job (Redis). API returns <100ms — no heavy work in request path.
3. Worker: classify (schema/sanity rules) → if failure: fingerprint →
   `INSERT incident ON CONFLICT (fingerprint) DO UPDATE count+1, last_seen`.
4. New fingerprint → enqueue `alert` job → email once. Existing → silent count bump.
5. Dashboard reads incidents; Phase 6 adds live updates over WebSocket.

## Boundaries & rules

- Modules in `packages/domain/*` import each other only via public `index.ts`.
- Worker never calls the API over HTTP — same codebase, shared modules (it's a monolith).
- All tenant-scoped queries go through a `withTenant(db, tenantId)` helper — no exceptions.
- Every experiment in `experiments/` must be runnable against `local` and `staging`.
