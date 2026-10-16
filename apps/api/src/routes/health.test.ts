import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { healthRoutes } from "./health";

interface HealthBody {
  ok: boolean;
  service: string;
}

interface ReadyBody {
  ok: boolean;
  checks: { db: boolean; redis: boolean };
}

describe("health routes", () => {
  const app = new Elysia().use(healthRoutes);

  it("GET /health → liveness always ok, no dependency checks", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body.ok).toBe(true);
    expect(body.service).toBe("wirewatch-api");
  });

  it("GET /ready → reports per-dependency checks", async () => {
    const res = await app.handle(new Request("http://localhost/ready"));
    const body = (await res.json()) as ReadyBody;
    // Without local redis running, redis check is false → 503. Either is a
    // valid, honest answer; the contract is the SHAPE of the response.
    expect([200, 503]).toContain(res.status);
    expect(typeof body.checks.db).toBe("boolean");
    expect(typeof body.checks.redis).toBe("boolean");
  });
});

