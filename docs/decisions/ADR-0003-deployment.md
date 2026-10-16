# ADR-0003 — Deployment: managed first (Vercel + Railway + Neon + Upstash), VPS later

- Status: **accepted** (2026-10-14, founder ruling D3)
- References: `docs/deployment/environments.md`, `research/market/sources.md` (pricing evidence)

## Decision

**Phase 1–8 (Architecture A, managed):** Vercel Hobby ($0, hard caps) for web;
Railway for `api` + `worker` services; Neon free Postgres; Upstash Redis.
**Phase 9 (Architecture B, self-host):** migrate everything to a single VPS with
Docker Compose + Caddy as the capstone DevOps exercise. All services dockerized
from day one so migration is a compose file, not a rewrite.

## Verified pricing basis (2026-10-14, see sources.md)

- Vercel Hobby: $0, 100 GB transfer, 1M CDN req/mo, **cannot overage**.
- Railway: after 30-day trial, Free = $1/mo (1 project, **3 services**, 0.5 GB RAM/service);
  Hobby = $5/mo min incl. $5 usage. api+worker = 2 of 3 free-plan service slots.
- Neon free: 1 GB/project, scale-to-zero. Upstash: free tier (re-verify limits Phase 1).

## Consequences

- Expected spend **$1–5/mo**; hard ceiling $10 with alerts at $4 (D8) configured
  in Railway + Vercel during Phase 1 (acceptance criterion).
- Railway Free's 0.5 GB RAM/service: api is fine; worker under backlog experiments
  may force Hobby — that decision is documented when measured, not before.
- Environments: `local` (docker compose) → `staging` (Railway/Vercel previews) →
  `production` (demo). No prod debug endpoints (D9, see ADR-0005/threat model).

## Alternatives rejected

- Self-host from day 1: ops burden before product learning; deferred, not denied.
- All-in on Vercel (functions for worker): wrong runtime model for queues/WS.
