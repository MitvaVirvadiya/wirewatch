# Security — Threat Model & Rules (living document)

## Assets & actors

Assets: tenant event payloads (may contain sensitive financial metadata even when
"synthetic" in lab), incident evidence, auth tokens, magic links, Stripe test data.
Actors: tenant users (4 roles), external recipients of magic links, attackers
(cross-tenant probing, replay, token theft), agents writing code.

## Threats → controls

| Threat | Control | Phase |
|---|---|---|
| Cross-tenant data access via API | `withTenant()` scoping + RBAC middleware + automated cross-tenant attack tests (`experiments/tenancy/`) | 2, tested continuously |
| Cross-tenant access via background job | Jobs carry `tenant_id`; worker re-scopes on dequeue; tests included | 4 |
| Webhook forgery | Per-monitor HMAC signature secrets; constant-time compare | 3 |
| Webhook replay | `UNIQUE(monitor_id, provider_event_id)` + idempotency keys | 3 |
| Magic-link abuse | Hashed at rest, ≤72h expiry, single-resource read-only scope, revocable, audited (ADR-0005) | 2 |
| Refresh-token theft | Rotation + reuse detection → family revocation | 2 |
| Debug/seed endpoints abused in prod | **Not deployed**: router tree only mounted when `APP_ENV=local|test`; CI asserts absence in prod build | 1, enforced CI |
| Secrets in repo | `.env.example` only; gitleaks in CI | 1 |
| Dependency supply chain | pnpm audit in CI; lockfile committed | 1 |
| Stripe webhook replay | Stripe signature verification + `stripe_events` idempotency ledger | 8 |
| Accidental real data | Simulator-only sources enforced by config allowlist; docs banner; no real-credential fields exist in schema | always |

## Known limitations (honest list)

- No Postgres Row-Level Security in MVP (OQ-01: evaluate Phase 9). Isolation rests
  on application-layer scoping + tests until then.
- Single-region managed DB; no DR plan beyond Neon point-in-time on free tier.
- Rate limiting: per-IP basic only until Phase 5.
- This system is **not** for production financial use; no compliance claims.

## Open questions

- OQ-01: RLS with Neon + Drizzle — connection-pooling interactions with
  `SET app.tenant_id` per transaction. Decide Phase 9.
- OQ-02: Magic links — single-use vs multi-use-until-expiry? Current: multi-use,
  read-only, audited. Revisit if status pages gain any mutation.
