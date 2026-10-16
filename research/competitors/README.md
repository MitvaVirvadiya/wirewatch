# Competitors — Direction 2

Prices marked ⚠️ were not re-verified this session; Phase 1 task: confirm + date-stamp.

## Generic incident management (indirect)

| Tool | Model | Gap vs Wirewatch |
|---|---|---|
| PagerDuty | Per-seat alert routing/on-call (⚠️ ~$21+/user/mo) | Knows nothing about feeds; alert fires only if *you* detected the failure |
| incident.io | Incident workflow + response (⚠️ free tier → per-seat) | Great incident UX — our Phase 6 collaboration borrows ideas — but detection is out of scope for it |
| Rootly | Similar to incident.io | Same gap |

## Uptime & synthetic monitoring (indirect)

| Tool | Model | Gap |
|---|---|---|
| BetterStack | Uptime + logs + status pages (⚠️ free tier) | HTTP-level checks only; no expected-schedule, schema, or staleness semantics |
| Checkly | Synthetic checks as code | Same — checks endpoints, not business payloads |
| Metrist | Third-party API monitoring | Closest concept; generic API health, not financial-feed contracts [HYPOTHESIS] |

## The actual status quo (primary competitor)

**Homegrown**: cron jobs + log alerts + someone noticing + a Slack message.
Wirewatch's wedge [HYPOTHESIS]: the failure taxonomy (late file, schema drift,
duplicate webhook, stale balance, partial day) is pre-built and finance-native,
so time-to-first-useful-signal is minutes, not a cron-script weekend.

## Defensibility notes

- Detection semantics + grouping quality = the moat, not the dashboard.
- Phase 6 realtime investigation is table stakes vs incident.io — differentiate on
  *what* is being investigated (a financial feed with evidence attached), not chat UX.
