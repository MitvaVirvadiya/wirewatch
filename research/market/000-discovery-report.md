# 000 — Discovery Report (condensed, post-decision)

*Full research conducted 2026-10-14. This file records the outcome; labels: [VERIFIED] sourced, [HYPOTHESIS] unproven belief, [DECIDED] founder ruling.*

## Directions evaluated

1. **ReconOps** — reconciliation exception workspace for small brokerages
2. **Provider reliability monitor for fintech integrations** ✅ **[DECIDED]**
3. **Ops ledger** — append-only ledger + recon for fintech startups

Direction 2 was selected over the initial hypothesis (Direction 1) per founder ruling D1:
the founder personally experienced provider-integration failures in brokerage work
and has direct demand knowledge. Directions 1 & 3 remain on the long-term roadmap —
the domain model (`events`, `fingerprints`, `exceptions`, `incidents`) is designed
to absorb them later without a rewrite.

## The problem (Direction 2)

Fintech products depend on external providers: broker APIs, market-data feeds,
payment webhooks, bank files. These fail in finance-specific ways that generic
uptime monitoring does not model:

- **Late/missing file** — the 06:00 positions file arrives at 09:00; nothing "errors"
- **Schema drift** — provider renames a field; parser silently drops records
- **Duplicate webhook** — retried delivery double-counts a deposit
- **Stale data** — endpoint returns 200 with yesterday's balances
- **Partial day** — feed delivers 80% of expected records, looks "up"

Generic tools (PagerDuty, incident.io, BetterStack, Checkly) detect HTTP-level
failure. The gap [HYPOTHESIS]: **business-level failure semantics** — expected
schedules, record-count sanity, schema contracts, duplicate detection, staleness.

## Demand evidence

- **[VERIFIED — primary]** Founder firsthand experience (recorded in
  `research/problem-validation/001-founder-context.md`). Formal interviews waived (D7).
- **[VERIFIED]** Adjacent pain documented by practitioners: reconciliation/ops teams
  discover provider failures manually; spreadsheet-based exception tracking fails at
  scale (Duco practitioner content; brokerage-ops commentary, see `research/market/sources.md`).
- **[HYPOTHESIS]** SMB fintechs will pay for this as a self-serve tool. Unproven —
  validated commercially only after the demo exists (Phase 2+).

## Competitors

See `research/competitors/README.md`. Summary: PagerDuty/incident.io/Rootly =
generic incident management; BetterStack/Checkly = generic uptime/synthetics;
Metrist = API monitoring (closest). None model financial-feed semantics. **[HYPOTHESIS]**

## MVP (approved scope → docs/product/mvp-scope.md)

Multi-tenant monitor: heartbeat expectations for provider files/webhooks,
webhook receivers with signature verification + dedupe, finance-aware failure
classification, incident grouping, email alerts, magic-link status views —
all demonstrable against an in-repo **synthetic provider simulator**.

## What would invalidate this

- Demo fails to resonate with 3+ fintech engineers (post-Phase-2 sharing)
- A generic tool ships financial-feed semantics natively
- Founder experience proves non-representative (test: does the failure taxonomy
  match what other fintech devs describe in public forums?)
