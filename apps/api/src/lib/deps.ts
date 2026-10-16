/**
 * Lazily-created dependency clients. Lazy so that `bun run src/server.ts`
 * boots even without DATABASE_URL in Phase 1 (health endpoint must answer
 * during deploy smoke tests before infra is wired).
 */
import postgres from "postgres";
import { Redis } from "ioredis";
import { env } from "../env";

let sqlClient: ReturnType<typeof postgres> | null = null;
let redisClient: Redis | null = null;

export function getSql() {
  if (!env.databaseUrl) return null;
  if (!sqlClient) {
    sqlClient = postgres(env.databaseUrl, { max: 5, prepare: true });
  }
  return sqlClient;
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
  await sqlClient?.end();
  redisClient?.disconnect();
}
