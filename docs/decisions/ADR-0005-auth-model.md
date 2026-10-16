# ADR-0005 — Auth: better-auth, invite-only, multi-admin tenants, magic-link status views

- Status: **accepted** (2026-10-14, founder ruling D6)

## Decision

`better-auth` as the auth library. Configuration:

1. **No public signup.** User accounts are created only via tenant-admin invite.
   `signUp` endpoints disabled; invite flow creates the account (email+password
   set-on-first-login or Google OAuth).
2. **Methods:** Google OAuth + email/password (both via better-auth plugins).
3. **Tenancy & roles:** `owner | admin | member | viewer` per tenant; **multiple
   admins per tenant supported**; a user may belong to multiple tenants
   (active-tenant context in session).
4. **Tokens:** short-lived JWT access token + rotating refresh token
   (better-auth session config; refresh rotation detects token-replay theft).
5. **Magic links for status views:** sharing "status of item X" (incident, monitor)
   with someone outside the tenant = single-purpose, expiring, scoped **read-only
   magic link token** — NOT an auth bypass, NOT a session. Implemented as a
   separate `magic_links` table (token hash, scope, expiry, single-use flag).

## Rationale

- Auth is not a learning objective here → library, not hand-rolled (D6).
- Invite-only matches the product (B2B teams) and kills public-signup abuse.
- Magic links are a genuine product surface ("send the client a live status link")
  and a security exercise: scoped, expiring, auditable.

## Consequences / rules

- Magic-link tokens are hashed at rest, expire ≤72h, scope = exactly one resource,
  read-only, revocable, logged in the audit trail.
- Refresh rotation + reuse detection: on reuse, revoke the whole token family.
- RBAC enforced in Elysia middleware **and** tenant-scoped queries (defense in
  depth; RLS evaluated in Phase 9 security hardening — open question OQ-01).
- Feature flags (Phase 7) must never gate authorization — flags ≠ authz.

## Alternatives rejected

- Hand-rolled auth: weeks of risk for no learning goal.
- Clerk/Auth0: cost + external dependency for a lab; better-auth is OSS and Bun-native.
