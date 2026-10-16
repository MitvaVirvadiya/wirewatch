import { Elysia } from "elysia";
import { sql } from "drizzle-orm";
import { env } from "../env";
import { getDb, getRedis, probe } from "../lib/deps";

/**
 * Liveness vs readiness — deliberately separate (docs/deployment/environments.md):
 *
 *   GET /health → liveness: is the process alive? No dependency checks.
 *                 A failing dependency must NEVER fail liveness, or the
 *                 orchestrator restart-loops a healthy process for a DB problem.
 *
 *   GET /ready  → readiness: can we serve real traffic? Checks Postgres + Redis.
 *                 Load balancers/route traffic on this; 503 = "don't send traffic,
 *                 but don't restart me either".
 */
export const healthRoutes = new Elysia({ prefix: "" })
  .get("/health", () => ({
    ok: true,
    service: "wirewatch-api",
    env: env.appEnv,
    uptimeSec: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  }))
  .get("/ready", async ({ set }) => {
    // Phase 2a: real Drizzle query against Postgres (the isLocal bypass is
    // gone). Only remaining bypass: `test` env without DATABASE_URL, so
    // `bun test` in CI needs no Postgres container.
    const dbHandle = getDb();
    const skipDb = env.appEnv === "test" && !dbHandle;
    const [db, redis] = await Promise.all([
      skipDb
        ? Promise.resolve(true)
        : dbHandle
          ? probe(() => dbHandle.db.execute(sql`SELECT 1`))
          : Promise.resolve(false),
      probe(() => getRedis().ping()),
    ]);
    const ok = db && redis;
    set.status = ok ? 200 : 503;
    return { ok, checks: { db, redis } };
  });
