# SESSION — 2026-10-16 — Phase 2b: simulator + signed ingestion (architect-agent, cline)

## What was done

Built TASK-52a79ed9: `@wirewatch/simulator` (6 modes: clean/late/duplicate/
drift/stale/partial), `POST /api/ingest/:monitorId` (HMAC-SHA256 + constant-time
compare, dedupe via the events UNIQUE, synchronous classification spike,
incident fingerprint upsert, alert-once, duplicate audit), migration 0001
(`investigating` status), 37 tests green, full 6-mode demo against the
dockerized API, live DB verification (16 events / 4 incidents / 4 alerts /
alert-once across processes), smoke 4/4.

## Why these choices

- **Classification runs synchronously in the request path (spike).** The
  architecture says enqueue-to-worker; queues are Phase 4. The spike proves
  the full data flow with tiny in-memory checks and is explicitly marked for
  extraction. Do NOT let it survive into load-bearing paths unchanged.
- **Idempotency key is a header (`x-provider-event-id`), not a payload field.**
  Dedupe identity belongs at the transport boundary; payloads stay opaque
  provider-shaped data.
- **Per-monitor HMAC secrets are impossible as currently modeled** — the
  schema stores `ingest_secret_hash`, but HMAC verification needs the
  plaintext key. v1 = shared `INGEST_HMAC_SECRET` env (HANDOFF-sanctioned
  fallback). Phase 3 must decide: encrypted (reversible) per-monitor secret
  storage or keep shared-secret + per-tenant secrets. Raised as open question.
- **Duplicate deliveries are audited (`audit_log`) but never become
  incidents** — per the MVP demo script ("deduped, logged").
- **Fingerprint = sha256(tenant|monitor|failure_type)** — globally unique
  constraint demands tenant context inside the string.

## Surprises (learned the hard way)

1. `bun test` in a turbo workspace does NOT load the repo-root `.env`
   (cwd = package dir) → integration tests silently skipped. Fix: package
   test script defaults `DATABASE_URL` to the compose Postgres (harmless;
   tests still skip fast when nothing listens — verified both paths).
2. `noUncheckedIndexedAccess` applies to array destructuring —
   `const [event] = list` is possibly-undefined; use a `firstEvent()` helper.
3. Docker build failed once with macOS `Keychain Error -25320` (credentials
   helper in headless context) — transient; a plain `docker pull` cleared
   it. If it recurs: `DOCKER_CONFIG=$(mktemp -d) docker …` bypasses the
   cred helper without touching user config.
4. A "failed" piped loop (`grep` exit 1) had actually executed all
   simulator deliveries — output filtering lied about side effects.
   Lesson: verify DB state directly after demo runs, which is how
   alert-once-across-processes got proven.

## Open questions

- Per-monitor ingest secret storage (encrypted) vs shared env secret —
  Phase 3, needs founder input.
- Resend (or other) email adapter timing — console adapter until Phase 4+.
- CI: integration tests currently skip in CI (no Postgres service in the
  unit-test job); compose smoke covers the happy path. Add a Postgres
  service to CI later for full integration coverage.
