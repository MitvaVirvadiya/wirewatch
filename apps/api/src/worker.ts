/**
 * Worker process entrypoint (ADR-0002: same codebase as the API, separate process).
 *
 * Phase 1: heartbeat loop + health server so Railway/docker can probe it.
 * Phase 4: this is where queue consumers live (classify → group → alert).
 *
 * Why a separate process at all, if it shares the codebase?
 *  - Independent restart/scale: an ingestion spike must not starve HTTP traffic.
 *  - Backpressure boundary: the worker controls dequeue rate; the API controls enqueue.
 *  - Crash isolation: a worker OOM never takes the API down (and vice versa).
 */
import { Elysia } from "elysia";
import { env } from "./env";
import { getRedis, shutdownDeps } from "./lib/deps";

const TICK_MS = 5_000;
let ticks = 0;

const health = new Elysia()
  .get("/health", () => ({
    ok: true,
    service: "wirewatch-worker",
    env: env.appEnv,
    ticks,
    uptimeSec: Math.floor(process.uptime()),
  }))
  .listen(env.workerPort);

const timer = setInterval(async () => {
  ticks += 1;
  try {
    await getRedis().ping();
    console.log(`[worker] tick=${ticks} redis=up`);
  } catch {
    console.warn(`[worker] tick=${ticks} redis=down (will retry — process stays alive)`);
  }
  // Phase 4: dequeue batch → classify → fingerprint → upsert incident → maybe alert
}, TICK_MS);

console.log(`[worker] wirewatch-worker health on :${env.workerPort}, tick every ${TICK_MS}ms`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`[worker] ${signal} received — draining`);
    clearInterval(timer);
    await shutdownDeps();
    process.exit(0);
  });
}

export { health };
