import { Elysia } from "elysia";
import { env } from "../env";
import { getRedis, getSql, probe } from "../lib/deps";

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
    const sql = getSql();
    const [db, redis] = await Promise.all([
      sql ? probe(() => sql`SELECT 1`) : Promise.resolve(env.isLocal), // local: DB optional until Phase 2
      probe(() => getRedis().ping()),
    ]);
    const ok = db && redis;
    set.status = ok ? 200 : 503;
    return { ok, checks: { db, redis } };
  });
