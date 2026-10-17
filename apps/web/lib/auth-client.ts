/**
 * better-auth browser client — talks to the API's /api/auth/* endpoints
 * (NEXT_PUBLIC_API_URL). Same-site cookies work across the port split
 * (localhost is one site), so credentials flow with `credentials: include`.
 */
import { createAuthClient } from "better-auth/client";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
});
