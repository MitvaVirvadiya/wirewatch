# L08 — Tenancy, isolation & billing surfaces in the data model

> Lands in Phase 2a/2c (data model + auth) and Phase 8 (billing). This note
> covers the **Phase 2a** part; billing sections arrive with Phase 8.

## Problem

Multiple fintech orgs share one Wirewatch deployment. A tenant must never
see another tenant's monitors, events, or incidents — and "never" has to
survive buggy code, not just correct code.

## Concepts

- **Shared-schema multi-tenancy**: one database, every tenant-owned row
  carries `tenant_id`. Cheapest to run (fits the $10/mo cap), hardest to
  isolate — isolation becomes a discipline, not a byproduct.
- **Defense in depth (app layer first, RLS later)**: today every query goes
  through a tenant-scoped path (`withTenant(db, tenantId)` — overview.md
  rule); RBAC is enforced in middleware AND in queries. Postgres **Row Level
  Security** is deliberately deferred to Phase 9 (OQ-01) — adding RLS later
  is a strengthen-in-depth step, not a redesign.
- **The schema as an invariant carrier**: `tenant_id` exists on
  `memberships, monitors, events, incidents, alerts, magic_links,
  audit_log` — with FK + cascade so tenant deletion is atomic garbage
  collection. The 13 contract tests in
  `packages/db/src/schema.test.ts` fail if anyone drops this.
- **Roles**: `owner | admin | member | viewer` per membership (not per
  user) — multiple admins per tenant and users in multiple tenants both
  fall out of the many-to-many shape (ADR-0005).
- **Magic links are capability tokens, not sessions**: hashed at rest,
  one resource, expiring, revocable, audited. `single_use` exists as a
  column because OQ-02 is genuinely open.

## Alternatives considered

- Database-per-tenant: isolation for free, but $/tenant breaks the spend
  cap and Neon free tier; revisit only if an enterprise persona appears.
- RLS from day one: correct but slows every Phase 2–8 query while the real
  learning goal is ingestion reliability; deferred to hardening (OQ-01).

## Implementation (Phase 2a)

`packages/db/src/schema/tenancy.ts` (tenants, memberships) + the
`tenant_id` columns across all domain tables; migrations in
`packages/db/drizzle/` (expand-only); seed demonstrates one tenant.

## Verification

- 13 schema contract tests green (`bun run test` in `@wirewatch/db`).
- Migration applied + seed run against local docker Postgres; idempotent
  on re-run. Full evidence: `project-memory/status/tasks/TASK-123684e9.md`.

## Observation

Writing the tenant_id rule as *tests* (not docs) is what makes it stick —
the schema now refuses to lose its isolation invariants silently.

## Implementation (Phase 2c addendum — auth landed 2026-10-17)

better-auth (core + drizzle adapter + bearer plugin) on the shared db pool;
**invite-only identity**: public sign-up blocked at the HTTP layer, accounts
are created only by `POST /api/invites` (tenant owner/admin, audited), and
the first account is bootstrapped by `seed:admin` (local only). Roles are
enforced live: `membershipIn(tenantId, userId, [owner, admin])` gates every
mutating tenant route. The cross-tenant attack became a **permanent
integration test** (`apps/api/src/routes/auth.test.ts`: tenant-A member must
NOT receive tenant-B monitors) — the threat-model control, executable.
Session-scoped reads (`/api/me`, `/api/monitors`, `/api/incidents`) all pass
through `visibleTenantIds()` — one helper, no route queries around it.

Verification: 40 tests green incl. isolation + RBAC; e2e against the
dockerized stack (sign-up 403 · invite 201 · viewer-invite 403). Full
evidence: `project-memory/status/tasks/TASK-c613e8ff.md`.

## Learning checkpoint questions (answer before Phase 2 is "done")

1. Why is `tenant_id` absent from `tenants` itself, and why is that NOT a
   tenancy hole?
2. App-layer scoping vs Postgres RLS: what concretely goes wrong if the
   `withTenant()` helper is skipped on ONE query, and what would RLS have
   caught that the helper wouldn't?
3. Why do memberships use (tenant_id, user_id) UNIQUE instead of making
   role a column on users? What does that buy for multi-admin tenants?
4. `alerts` has `tenant_id` although `incident_id` already implies it —
   what queries/audit trails does the denormalized column enable, and what
   does it cost?
5. If we enable RLS in Phase 9, which existing tests would catch a
   misconfigured policy on `events`, and which wouldn't?

Phase 2c additions:

6. A user belongs to tenants A and B — the dashboard currently mixes both
   tenants' rows. When does that become a real problem (switcher? filter?
   RLS makes it moot?), and which artifact should record the decision?
7. Invite temp passwords are echoed in API responses in local/test only.
   Walk through: what breaks if that gate (`env.isLocal`) is ever wrong in
   production, and which layer would catch it?
8. If a future route forgets `membershipIn()`, nothing fails — it is just
   under-scoped. What guard catches this class of bug: a route template, a
   lint rule, or RLS? What are you willing to build now vs defer?
