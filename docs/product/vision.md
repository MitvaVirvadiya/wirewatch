# Product Vision — Wirewatch

## One-liner

PagerDuty knows when your *server* is down. Wirewatch knows when your **broker's
data** is wrong — before your customers do.

## Who

Founding engineers and ops engineers at small fintechs (2–50 people) integrating
brokers, market-data feeds, payment providers, and bank files.

## The insight (failure taxonomy — the product's spine)

| Failure type | What generic tools see | What Wirewatch sees |
|---|---|---|
| `late_file` | nothing (no error) | positions file due 06:00 UTC, now 06:15 → breach |
| `schema_drift` | 200 OK | field renamed, parse dropped 3 cols → contract violation |
| `duplicate_webhook` | 2 × 200 OK | same provider event ID twice → dedupe + flag |
| `stale_data` | 200 OK | balance timestamp older than threshold |
| `partial_day` | 200 OK | 80% of expected record count delivered |
| `provider_5xx` / `timeout` / `auth_failure` | yes ✅ | yes, with financial context attached |

## Principles

1. **Detect at the business layer**, alert at the right layer (one alert per root cause).
2. **Evidence-first incidents**: every incident links the raw payloads, diffs, and timeline.
3. **Synthetic-first**: the in-repo provider simulator is a product feature (demos,
   onboarding, sandbox), not just a test tool.
4. **No custody, no claims**: we monitor metadata about feeds; we never move money,
   never claim regulatory compliance.
