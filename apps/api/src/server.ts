import { Elysia } from "elysia";
import { debugEndpointsAllowed, env } from "./env";
import { shutdownDeps } from "./lib/deps";
import { healthRoutes } from "./routes/health";

const app = new Elysia()
  .use(healthRoutes)
  .get("/", () => ({
    service: "wirewatch-api",
    env: env.appEnv,
    docs: "https://github.com/ — see finlab/docs/architecture/overview.md",
  }))
  // ── Debug/seed/simulator routers mount here in later phases ──────────
  // Guard: if (!debugEndpointsAllowed()) they are NEVER mounted (threat model).
  // Phase 1 has none; CI asserts /api/debug/* is 404 in non-local builds.
  .listen(env.port);

if (debugEndpointsAllowed()) {
  console.log(`[api] APP_ENV=${env.appEnv} — debug endpoints would be allowed (none mounted yet)`);
}

console.log(`[api] wirewatch-api listening on :${app.server?.port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`[api] ${signal} received — graceful shutdown`);
    await shutdownDeps();
    process.exit(0);
  });
}

export type App = typeof app;
