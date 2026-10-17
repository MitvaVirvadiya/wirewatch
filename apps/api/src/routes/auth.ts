/**
 * better-auth handler mounted under /api/auth/* (Elysia passes the raw
 * Request through — better-auth owns routing, cookies, CORS for its paths
 * via trustedOrigins).
 *
 * THE GUARD: public sign-up is blocked HERE, at the HTTP layer, because
 * better-auth's `disableSignUp` would also block our server-side invite
 * flow (auth.api.signUpEmail). Route guard = invite-only enforced + tested
 * (ADR-0005: no public signup; accounts are created only via tenant-admin
 * invite).
 */
import { Elysia } from "elysia";
import { getAuth } from "../lib/auth";

export const authRoutes = new Elysia({ prefix: "/api/auth" }).all(
  "/*",
  async ({ request, set }) => {
    const url = new URL(request.url);
    if (
      request.method === "POST" &&
      (url.pathname.endsWith("/sign-up/email") ||
        url.pathname.endsWith("/sign-up"))
    ) {
      set.status = 403;
      return {
        ok: false,
        error: "Public sign-up is disabled — Wirewatch is invite-only (ADR-0005)",
      };
    }
    return getAuth().handler(request);
  },
);
