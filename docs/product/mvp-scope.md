# MVP Scope (Phases 2–4 only — later phases extend, don't redefine)

## In scope

**Monitors**
- `heartbeat` monitor: "provider X must deliver file/feed/ws-tick by schedule S (cron + grace period)"
- `webhook` receiver: per-tenant signed ingestion endpoint, dedupe by provider event ID
- `contract` check (basic): JSON schema per feed; violations → `schema_drift`
- Sanity rules v1: expected record-count band, max data-age (staleness)

**Pipeline**
- Ingestion → classify → group into incidents (fingerprint = monitor + failure type + provider)
- Alert-once per new incident: email (Resend free tier or console-log adapter in dev)
- Incident lifecycle: `open → acknowledged → investigating → resolved` with reason

**Tenancy & auth** (ADR-0005): invite-only, roles, active-tenant switcher

**Status sharing**: magic-link read-only view of a single incident/monitor

**Synthetic provider simulator** (`scripts/simulator/`): emits feeds & webhooks on
schedules with knobs for every failure type above. This IS the demo.

## Out of scope (deferred, with phase)

- Realtime investigation UI → Phase 6
- Rule rollouts via flags + shadow evaluation → Phase 7
- Usage metering + Stripe test billing → Phase 8
- Fuzzy/ML anomaly detection, real provider SDKs, pager/phone alerts, SLA reporting → roadmap
- RLS hardening → Phase 9 (OQ-01)

## Demo script the MVP must support

1. Tenant "Acme Brokerage" configures 3 synthetic providers (positions feed 06:00,
   trades webhook, balance poll 5m).
2. Simulator runs clean → all green.
3. Simulator: delay positions file → `late_file` incident appears, one email.
4. Simulator: fire duplicate trade webhook → deduped, `duplicate_webhook` logged.
5. Share incident via magic link → read-only status page.
6. Dashboard shows timeline, evidence payload, resolution note.
