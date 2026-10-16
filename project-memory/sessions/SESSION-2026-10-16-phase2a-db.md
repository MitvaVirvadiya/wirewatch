# SESSION — 2026-10-16 — Phase 2a: @wirewatch/db (architect-agent, cline)

## What was done

Built `@wirewatch/db` (TASK-123684e9): Drizzle schema (13 tables, 4 enums)
matching the data-model sketch, generated + applied migration, seed (1 dev
tenant + 3 monitors), 13 contract tests, wired into apps/api (`getDb()`,
real `/ready` Drizzle probe), rebuilt the Docker stack, smoke 4/4.

## Why these choices

- **better-auth core tables copied field-for-field** (verified against
  better-auth docs) with snake_case columns — Phase 2c can adopt them with
  zero migration. `memberships` stays a custom table (our roles are
  owner/admin/member/viewer per ADR-0005).
- **`incidents.fingerprint` is globally unique** per the sketch (the
  contract). Consequence documented in schema: fingerprint strings MUST
  embed tenant + monitor context (sha256(tenant|monitor|failure|keys)).
- **`incident_events` carries no tenant_id** — pure link table between two
  tenant-scoped parents (documented exception in schema.test.ts).
- **`alerts` carries tenant_id** even though incident implies it — the
  handoff rule says every tenant-owned table.

## Surprises (learned the hard way)

1. **No git repo existed** — protocol assumes commits. Initialized at task
   start: retroactive Phase 1 baseline + claim commit. Noted in STATUS.md.
2. **`bun --filter pkg run script` is the wrong order** — correct:
   `bun run --filter pkg script`. Root `db:*` scripts had it wrong (never
   executed before). Fixed + added `db:seed`.
3. **Docker build broke** after adding the workspace dep: Dockerfile.api
   didn't copy `packages/db/package.json` before `bun install` → "pruned
   workspace" error. Rule: every new workspace package manifest must be
   COPYed before install.
4. `bun add` picked `typescript@7.0.2` while the workspace pins `^5.6.0` —
   re-pinned to `^5.6.0` (resolved 5.9.3) for consistency.
5. `getTableConfig()` exposes `uniqueConstraints` (not `uniques`) —
   contract tests use it to assert the Capability-A constraints.
6. Phase 1's "awaiting founder 4/4 confirmation" is now moot: observed
   all services healthy + `/ready` ok + smoke 4/4 during this session.

## Open questions

- better-auth's organization plugin vs our custom `memberships` table —
  decide when Phase 2c wires auth (plugin tables would need a new ADR +
  migration; the custom table is compatible either way).
- `pnpm-workspace.yaml` still on disk though retired (ADR-0006) — remove in
  next housekeeping commit.
- Nothing deployed — staging deploy still blocked on founder accounts.
