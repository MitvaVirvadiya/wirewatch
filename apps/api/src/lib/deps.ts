/**
 * Lazily-created dependency clients. Lazy so that `bun run src/server.ts`
 * boots even without DATABASE_URL (health endpoint must answer during
 * deploy smoke tests before infra is wired).
 *
 * Phase 2a: the raw `postgres` client is replaced by the @wirewatch/db
 * Drizzle handle (schema included) — same underlying postgres.js pool,
 * but every query now goes through typed, schema-aware Drizzle.
 */
import { Redis } from "ioredis";
import { createDb, type DbHandle } from "@wirewatch/db";
import { env } from "../env";

let dbHandle: DbHandle | null = null;
let redisClient: Redis | null = null;

/**
 * Returns null only when DATABASE_URL is unset — /ready then reports
 * db:false honestly. The only sanctioned bypass is `test` (see /ready).
 */
export function getDb(): DbHandle | null {
  if (!env.databaseUrl) return null;
  if (!dbHandle) {
    dbHandle = createDb(env.databaseUrl);
  }
  return dbHandle;
}

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2_000),
    });
  }
  return redisClient;
}

/** Readiness probe with timeout — a hung dependency must not hang /ready. */
export async function probe<T>(fn: () => Promise<T>, ms = 1_500): Promise<boolean> {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("probe timeout")), ms)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function shutdownDeps(): Promise<void> {
  await dbHandle?.sql.end();
  redisClient?.disconnect();
}
