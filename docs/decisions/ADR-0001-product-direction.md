# ADR-0001 — Product direction: finance-aware provider reliability monitor

- Status: **accepted** (2026-10-14, founder ruling D1/D7)
- Deciders: founder + architect agent
- References: `research/market/000-discovery-report.md`

## Decision

Build Direction 2: reliability monitoring for financial provider integrations
(late files, schema drift, duplicate webhooks, stale data, partial deliveries),
starting from founder-experienced pain. Directions 1 (recon exceptions) and 3
(ledger) remain roadmap candidates; the domain model must not preclude them.

## Rationale

1. Primary demand evidence (founder experience) beats inferred market gaps.
2. Only direction where capability A (reliable ingestion) and C (failure pipeline)
   are the product itself, not plumbing.
3. Synthetic-data demo-ability is total — the "providers" are simulators we own.

## Consequences

- Capability B (realtime collab) and D (flags) are phase-6/7 features on incidents
  and detection rules — they must earn their place with real usage scenarios.
- Competitor set is generic incident/uptime tools; differentiation = financial
  failure semantics. Marketing must never claim regulatory/compliance value.
- Domain model keeps `events`/`fingerprints`/`exceptions` generic for future absorption.

## Alternatives rejected

- ReconOps first: strong, but demand evidence weaker for us; retained as roadmap.
- Ops ledger: crowded, funded competitors; weakest capability fit.
