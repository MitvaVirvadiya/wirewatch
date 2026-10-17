/**
 * better-auth instance (ADR-0005): invite-only, email/password now,
 * Google OAuth env-gated (enabled only when GOOGLE_CLIENT_ID/SECRET are
 * set — decided 2026-10-16, founder-reviewable).
 *
 * Schema note: our core tables (user/session/account/verification in
 * packages/db) are better-auth-compatible by design — the adapter maps
 * its field names to our TS keys, snake_case columns underneath.
 *
 * Tenancy note: memberships stay OUR custom table (ADR-0005 roles);
 * better-auth's organization plugin was evaluated and rejected for 2c
 * (own tables + different role model → would need a new ADR).
 *
 * Public sign-up is NOT disabled via better-auth's `disableSignUp` (that
 * would also block our server-side invite flow's user creation) — it is
 * blocked at the HTTP layer in routes/auth.ts (guarded + tested there).
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import * as schema from "@wirewatch/db/schema";
import { env } from "../env";
import { getDb } from "./deps";

type Auth = ReturnType<typeof buildAuth>;

function buildAuth(db: Parameters<typeof drizzleAdapter>[0]) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleEnabled = Boolean(googleClientId && googleClientSecret);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-better-auth-secret-local-only",
    baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${env.port}`,
    trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:3100"],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // rotate session once a day
    },
    plugins: [bearer()],
    // Google OAuth is env-gated: present in config only when credentials
    // exist, so the sign-in options honestly reflect what is enabled.
    socialProviders: googleEnabled
      ? {
          google: {
            clientId: googleClientId as string,
            clientSecret: googleClientSecret as string,
          },
        }
      : {},
  });
}

let cached: Auth | null = null;

export function getAuth(): Auth {
  if (cached) return cached;
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize auth");
  }
  const dbHandle = getDb();
  if (!dbHandle) {
    throw new Error("database handle unavailable — cannot initialize auth");
  }
  const auth = buildAuth(dbHandle.db);
  cached = auth;
  return auth;
}

/** Reset between tests (never call in production paths). */
export function resetAuthForTests(): void {
  cached = null;
}
