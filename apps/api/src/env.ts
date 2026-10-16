/**
 * Central environment parsing. Fail fast on missing required vars;
 * APP_ENV gates dangerous surfaces (debug/seed/simulator) per threat model.
 */

export type AppEnv = "local" | "test" | "staging" | "production";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

const appEnv = optional("APP_ENV", "local") as AppEnv;
if (!["local", "test", "staging", "production"].includes(appEnv)) {
  throw new Error(`Invalid APP_ENV: ${appEnv}`);
}

export const env = {
  appEnv,
  isLocal: appEnv === "local" || appEnv === "test",
  port: Number(optional("PORT", "3001")),
  workerPort: Number(optional("WORKER_PORT", "3002")),
  databaseUrl: optional("DATABASE_URL"), // optional in Phase 1; required once @wirewatch/db lands
  redisUrl: optional("REDIS_URL", "redis://localhost:6379"),
  logLevel: optional("LOG_LEVEL", "info"),
  sentryDsn: optional("SENTRY_DSN"),
} as const;

/** Guard for debug/seed/simulator routers — mount ONLY when this is true. */
export function debugEndpointsAllowed(): boolean {
  return env.isLocal;
}

/** Call from entrypoints that need the database. */
export function requireDatabaseUrl(): string {
  return required("DATABASE_URL");
}
