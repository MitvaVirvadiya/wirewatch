/**
 * Drizzle client factory (ADR-0004: Drizzle over Prisma — explicit
 * SQL-level control for Capability A).
 *
 * The underlying postgres.js client is kept on the handle so callers
 * can `.end()` it on graceful shutdown (apps/api/src/lib/deps.ts does).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export interface CreateDbOptions {
  /** Max pooled connections (postgres.js default is 10). */
  max?: number;
}

export function createDb(
  databaseUrl: string,
  options: CreateDbOptions = {},
) {
  const sql = postgres(databaseUrl, {
    max: options.max ?? 5,
    prepare: true,
  });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type DbHandle = ReturnType<typeof createDb>;

/**
 * Database URL resolution for scripts (migrate/seed/generate):
 * DATABASE_URL wins; local/test fall back to the docker-compose
 * credentials; staging/production fail fast rather than guessing.
 */
export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  const appEnv = (process.env.APP_ENV ?? "local") as string;
  if (appEnv === "local" || appEnv === "test") {
    // Matches docker-compose.yml postgres service.
    return "postgres://wirewatch:wirewatch@localhost:5432/wirewatch";
  }
  throw new Error(
    `DATABASE_URL is required when APP_ENV=${appEnv} — refusing to guess`,
  );
}
