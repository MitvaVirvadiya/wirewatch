---
id: TASK-52a79ed9
title: Phase 2b — synthetic provider simulator + signed ingestion spike
status: claimed
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

(filled on completion)

## Verification

(filled on completion)
