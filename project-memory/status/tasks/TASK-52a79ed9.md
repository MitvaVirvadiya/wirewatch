---
id: TASK-52a79ed9
title: Phase 2b — synthetic provider simulator + signed ingestion spike
status: review
claimed_by: architect-agent (cline)
branch: main (solo session; branch protocol activates with parallel agents)
owns:
  - scripts/simulator/**
  - apps/api/src/routes/ingest.ts
  - apps/api/src/routes/ingest.test.ts
  - apps/api/src/lib/classify.ts
  - apps/api/src/lib/alerts.ts
  - apps/api/src/server.ts (mount only)
  - packages/db/src/schema/incidents.ts (status enum add 'investigating' only)
  - docker-compose.yml (ingest secret env only)
  - .env.example (ingest secret default only)
  - package.json (sim:run script only)
  - .env (local-only secrets sync; gitignored)
depends_on: [TASK-123684e9]
verify:
  - bun run typecheck
  - bun run test (unit + integration against local Postgres)
  - bun run --filter @wirewatch/simulator run --mode clean|late|duplicate|drift|stale
  - incidents/alerts rows verified in DB
  - docker compose up --build -d api worker && bun scripts/smoke.ts
created: 2026-10-16T21:00:00Z
---

## Scope

Per HANDOFF §5 + mvp-scope (Phases 2–4 contract):

- `scripts/simulator/` v1 (`@wirewatch/simulator`): synthetic provider that
  emits webhook / heartbeat / poll events for the 3 seeded monitors, with
  failure knobs: `clean`, `late`, `duplicate`, `drift`, `stale`.
- `POST /api/ingest/:monitorId`: HMAC-SHA256 signature verification
  (`INGEST_HMAC_SECRET` env — per-monitor secret stored as a *hash* cannot
  verify an HMAC, so v1 is env-fallback only; per-monitor secret storage is
  flagged as an open question for Phase 3), constant-time compare.
- Dedupe: `INSERT … ON CONFLICT (monitor_id, provider_event_id) DO NOTHING`
  → 202 either way; duplicates flagged in response + audit_log.
- Classification spike (synchronous, explicitly a spike — Phase 4 moves it to
  the queue/worker): contract check (required fields) → `schema_drift`;
  sanity check (maxAgeHours, lateness vs grace_sec) → `stale_data` /
  `late_file`. Failures upsert incidents on UNIQUE(fingerprint);
  occurrence_count++ on repeat. New incident → alert-once insert
  (`UNIQUE(incident_id)`) + console-log email adapter (dev).
- `incident_status` enum gains `investigating` (mvp-scope lifecycle) —
  expand-only migration 0001.

## Expected outputs

- Simulator demo (clean → all pass; late/duplicate/drift/stale → correct
  incidents/dedupe behavior per the MVP demo script steps 2–4).
- Integration tests: HMAC pass/fail, dedupe idempotency, drift → incident,
  repeat → occurrence_count+1 with NO second alert (alert-once).
- Smoke 4/4 still green after rebuild.

## Summary of changes

- `packages/db`: `incident_status` enum gained `investigating` (mvp-scope
  lifecycle) — migration `0001_rapid_meltdown.sql`, applied. Seed NAV sanity
  now carries `minRowCount: 100` (partial-delivery band); existing dev row
  synced via SQL.
- `apps/api/src/lib/classify.ts`: pure classifier — contract check
  (requiredFields → `schema_drift`), record-count band (`minRowCount` →
  `partial_delivery`), data age (`maxAgeHours`/`maxStalenessMinutes` →
  `stale_data`), heartbeat lateness vs `graceSec` (`late_file`).
  `incidentFingerprint()` = sha256(tenant|monitor|failure_type) — embeds
  tenant context per the globally-unique fingerprint contract.
- `apps/api/src/lib/alerts.ts`: alert-once insert (`ON CONFLICT (incident_id)
  DO NOTHING`) + dev console-log email adapter (mvp-scope sanctioned;
  Resend later behind the same function).
- `apps/api/src/routes/ingest.ts`: `POST /api/ingest/:monitorId` —
  HMAC-SHA256 over raw body (`x-wirewatch-signature`, constant-time
  compare, secret read lazily from `INGEST_HMAC_SECRET`), provider
  idempotency key via `x-provider-event-id`, `ON CONFLICT DO NOTHING`
  dedupe (202 either way; duplicates flagged + `audit_log`ed),
  synchronous classification spike (Phase 4 moves it to the queue),
  incident upsert on `UNIQUE(fingerprint)` (count+1, last_seen),
  `incident_events` evidence link, alert-once on new incidents.
  Mounted in `server.ts` (public signed route — not session auth).
  Known limitation (open question, Phase 3): per-monitor secrets are
  stored HASHED — an HMAC cannot be verified against a one-way hash, so
  v1 uses the shared env secret; per-monitor needs reversible (encrypted)
  storage.
- `apps/api/src/routes/ingest.test.ts`: 10 integration tests (skipped
  gracefully when no Postgres reachable; local `.env`-less runs get a
  harmless localhost default via the package test script) + pure classify
  unit test. Covers: 401 bad signature, 404 unknown monitor, clean ingest,
  duplicate → one row + audit, drift → incident + count bump + exactly one
  alert, late, stale, partial, 400s.
- `scripts/simulator/` (`@wirewatch/simulator`): pure payload generators
  (`providers.ts`) with 6 modes (clean/late/duplicate/drift/stale/partial),
  `sign.ts` (same HMAC scheme as the endpoint), `run.ts` CLI
  (`bun run sim:run -- --mode <mode>`; looks up seeded tenant/monitors via
  @wirewatch/db, delivers signed events, prints per-event results),
  `providers.test.ts` (6 unit tests pinning provider shapes to the seeded
  contract/sanity).
- Plumbing: root `sim:run` script; `INGEST_HMAC_SECRET=dev-ingest-secret`
  in `.env` / `.env.example` / docker-compose api env (host simulator ↔
  container API now share the secret); apps/api test script defaults
  DATABASE_URL to the compose Postgres.

## Verification

**Level: `tested-locally`** — all commands executed 2026-10-16.

- `bun install` · `bun run typecheck` — 4/4 packages green
- `bun run test` — **37 green, 0 fail** (13 db schema contract, 13 api
  incl. 10 ingestion integration against live Postgres, 6 simulator unit,
  + db/api counts), integration tests run when Postgres reachable, skip
  otherwise (verified both paths)
- Migration `0001` generated + applied; `investigating` confirmed in
  `enum_range` on live Postgres
- Simulator against the **dockerized** api (rebuilt with ingest route +
  shared secret), all 6 modes:
  - clean → 3×202, no incidents
  - duplicate → 2nd delivery `duplicate:true`, still one event row
  - late/drift/stale/partial → correct `failure_type` incidents
- Live DB after two full demo runs (18 deliveries → 16 stored):
  4 incidents × `occurrence_count=2` (grouping upsert), 8 `incident_events`
  links, **4 alerts — alert-once held across separate processes**, 2
  `duplicate_webhook` audit rows, per-monitor event counts exactly match
  expected (6/6/4)
- `docker compose up --build -d api worker` + `bun scripts/smoke.ts` → 4/4

Not done: queue-based classification (Phase 4), real email (Resend),
staging deploy.
