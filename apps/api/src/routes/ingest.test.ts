/**
 * Ingestion integration tests — require a reachable Postgres (the local
 * docker-compose stack). When no DB is reachable (e.g. plain CI unit runs),
 * every test below skips instead of failing — the health-route contract
 * tests in health.test.ts still run everywhere.
 *
 * These tests prove Capability A end-to-end at the route level:
 * signature verification, dedupe idempotency (the UNIQUE constraint),
 * all four failure classifications, incident grouping (occurrence_count),
 * and alert-once.
 */
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import {
  alerts,
  auditLog,
  events,
  incidents,
  monitors,
  tenants,
} from "@wirewatch/db";
import { getDb, shutdownDeps } from "../lib/deps";
import { ingestRoutes } from "./ingest";

process.env.INGEST_HMAC_SECRET ??= "test-ingest-secret";

const app = new Elysia().use(ingestRoutes);
const dbHandle = getDb();

// DB availability probe with timeout (a hung connect must not hang tests).
let dbAvailable = false;
if (dbHandle) {
  try {
    await Promise.race([
      dbHandle.db.execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("probe timeout")), 3_000),
      ),
    ]);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
}
const itDb: typeof it = dbAvailable ? it : it.skip;

// ── Fixture: isolated tenant + 3 monitors (deleted by cascade on cleanup) ──
let tenantId = "";
let webhookMonitorId = "";
let heartbeatMonitorId = "";
let pollMonitorId = "";

if (dbAvailable && dbHandle) {
  const { db } = dbHandle;
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Ingest Test Tenant (auto)",
      slug: `ingest-test-${Date.now()}`,
    })
    .returning({ id: tenants.id });
  tenantId = tenant!.id;

  const created = await db
    .insert(monitors)
    .values([
      {
        tenantId,
        name: "test webhook feed",
        type: "webhook",
        graceSec: 0,
        contractSchema: {
          requiredFields: ["event_id", "type", "amount", "currency", "status"],
        },
        sanity: { maxAgeHours: 24 },
      },
      {
        tenantId,
        name: "test heartbeat file",
        type: "heartbeat",
        graceSec: 60,
        contractSchema: {
          requiredFields: ["nav_file_id", "as_of_date", "sha256", "row_count"],
        },
        sanity: { maxAgeHours: 26, minRowCount: 100 },
      },
      {
        tenantId,
        name: "test poll feed",
        type: "poll",
        graceSec: 0,
        contractSchema: { requiredFields: ["pair", "rate", "as_of"] },
        sanity: { maxStalenessMinutes: 30 },
      },
    ])
    .returning({ id: monitors.id, name: monitors.name });

  webhookMonitorId = created.find((m) => m.name === "test webhook feed")!.id;
  heartbeatMonitorId = created.find((m) => m.name === "test heartbeat file")!.id;
  pollMonitorId = created.find((m) => m.name === "test poll feed")!.id;
}

afterAll(async () => {
  if (dbAvailable && dbHandle && tenantId) {
    await dbHandle.db.delete(tenants).where(eq(tenants.id, tenantId));
  }
  await shutdownDeps();
});

// ── Helpers ─────────────────────────────────────────────────────────────
function signedRequest(
  monitorId: string,
  providerEventId: string,
  payload: unknown,
  opts: { sign?: boolean } = {},
) {
  const raw = JSON.stringify(payload);
  const secret = process.env.INGEST_HMAC_SECRET!;
  const signature =
    opts.sign === false
      ? "0".repeat(64)
      : createHmac("sha256", secret).update(raw).digest("hex");
  return new Request(`http://localhost/api/ingest/${monitorId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-provider-event-id": providerEventId,
      "x-wirewatch-signature": signature,
    },
    body: raw,
  });
}

function goodWebhookPayload(id: string) {
  return {
    event_id: id,
    type: "payment.settled",
    amount: "125.00",
    currency: "USD",
    status: "settled",
    as_of: new Date().toISOString(),
  };
}

function goodHeartbeatPayload(id: string, opts: { rowCount?: number; scheduledAt?: Date; asOf?: Date } = {}) {
  return {
    nav_file_id: id,
    as_of_date: (opts.asOf ?? new Date()).toISOString(),
    sha256: "a".repeat(64),
    row_count: opts.rowCount ?? 5_000,
    ...(opts.scheduledAt ? { scheduled_at: opts.scheduledAt.toISOString() } : {}),
  };
}

function goodPollPayload(opts: { asOf?: Date } = {}) {
  return {
    pair: "EUR/USD",
    rate: "1.0850",
    as_of: (opts.asOf ?? new Date()).toISOString(),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────
describe("POST /api/ingest/:monitorId — signed ingestion", () => {
  itDb("bad signature → 401 (fail closed, no event stored)", async () => {
    const res = await app.handle(
      signedRequest(webhookMonitorId, "sig-1", goodWebhookPayload("sig-1"), {
        sign: false,
      }),
    );
    expect(res.status).toBe(401);
    if (dbHandle) {
      const rows = await dbHandle.db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.providerEventId, "sig-1"));
      expect(rows.length).toBe(0);
    }
  });

  itDb("unknown monitor → 404", async () => {
    const res = await app.handle(
      signedRequest(
        "00000000-0000-0000-0000-000000000000",
        "x-1",
        goodWebhookPayload("x-1"),
      ),
    );
    expect(res.status).toBe(404);
  });

  itDb("clean webhook → 202, stored, no incident", async () => {
    const res = await app.handle(
      signedRequest(webhookMonitorId, "clean-1", goodWebhookPayload("clean-1")),
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { ok: boolean; duplicate: boolean };
    expect(body.ok).toBe(true);
    expect(body.duplicate).toBe(false);
    if (dbHandle) {
      const rows = await dbHandle.db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.providerEventId, "clean-1"));
      expect(rows.length).toBe(1);
    }
  });

  itDb(
    "duplicate delivery → 202 + duplicate:true, STILL one event row (dedupe), audited",
    async () => {
      const first = await app.handle(
        signedRequest(webhookMonitorId, "dup-1", goodWebhookPayload("dup-1")),
      );
      expect(first.status).toBe(202);
      const second = await app.handle(
        signedRequest(webhookMonitorId, "dup-1", goodWebhookPayload("dup-1")),
      );
      expect(second.status).toBe(202);
      const body = (await second.json()) as { duplicate: boolean };
      expect(body.duplicate).toBe(true);
      if (dbHandle) {
        const rows = await dbHandle.db
          .select({ id: events.id })
          .from(events)
          .where(eq(events.providerEventId, "dup-1"));
        expect(rows.length).toBe(1); // THE dedupe guarantee
        const audits = await dbHandle.db
          .select({ action: auditLog.action })
          .from(auditLog)
          .where(eq(auditLog.action, "duplicate_webhook"));
        expect(audits.length).toBeGreaterThan(0);
      }
    },
  );

  itDb("schema drift → incident; repeat bumps count, NO second alert (alert-once)", async () => {
    const driftPayload = { event_id: "drift-1", type: "payment.settled" }; // amount/currency/status missing
    const first = await app.handle(
      signedRequest(webhookMonitorId, "drift-1", driftPayload),
    );
    expect(first.status).toBe(202);
    const firstBody = (await first.json()) as {
      incident: { failureType: string; occurrenceCount: number; new: boolean; id: string };
    };
    expect(firstBody.incident.failureType).toBe("schema_drift");
    expect(firstBody.incident.occurrenceCount).toBe(1);
    expect(firstBody.incident.new).toBe(true);

    // Same failure again with a DIFFERENT provider event id → grouped, not new.
    const second = await app.handle(
      signedRequest(webhookMonitorId, "drift-2", driftPayload),
    );
    const secondBody = (await second.json()) as {
      incident: { occurrenceCount: number; new: boolean; id: string };
    };
    expect(secondBody.incident.occurrenceCount).toBe(2);
    expect(secondBody.incident.new).toBe(false);
    expect(secondBody.incident.id).toBe(firstBody.incident.id);

    // Alert-once: exactly one alerts row for this incident.
    if (dbHandle) {
      const alertRows = await dbHandle.db
        .select({ id: alerts.id })
        .from(alerts)
        .where(eq(alerts.incidentId, firstBody.incident.id));
      expect(alertRows.length).toBe(1);
      const incidentRows = await dbHandle.db
        .select({ c: incidents.occurrenceCount })
        .from(incidents)
        .where(eq(incidents.id, firstBody.incident.id));
      expect(incidentRows[0]!.c).toBe(2);
    }
  });

  itDb("late heartbeat (past grace) → late_file incident", async () => {
    const payload = goodHeartbeatPayload("late-1", {
      scheduledAt: new Date(Date.now() - 3_600_000), // 1h late, grace 60s
    });
    const res = await app.handle(
      signedRequest(heartbeatMonitorId, "late-1", payload),
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { incident: { failureType: string } };
    expect(body.incident.failureType).toBe("late_file");
  });

  itDb("stale poll data (as_of too old) → stale_data incident", async () => {
    const payload = goodPollPayload({
      asOf: new Date(Date.now() - 2 * 3_600_000), // 2h old, max 30min
    });
    const res = await app.handle(
      signedRequest(pollMonitorId, "stale-1", payload),
    );
    const body = (await res.json()) as { incident: { failureType: string } };
    expect(body.incident.failureType).toBe("stale_data");
  });

  itDb("partial delivery (row_count below band) → partial_delivery incident", async () => {
    const payload = goodHeartbeatPayload("partial-1", { rowCount: 5 }); // min 100
    const res = await app.handle(
      signedRequest(heartbeatMonitorId, "partial-1", payload),
    );
    const body = (await res.json()) as { incident: { failureType: string } };
    expect(body.incident.failureType).toBe("partial_delivery");
  });

  itDb("missing provider event id header → 400", async () => {
    const raw = JSON.stringify(goodWebhookPayload("no-id-1"));
    const secret = process.env.INGEST_HMAC_SECRET!;
    const signature = createHmac("sha256", secret).update(raw).digest("hex");
    const res = await app.handle(
      new Request(`http://localhost/api/ingest/${webhookMonitorId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wirewatch-signature": signature,
        },
        body: raw,
      }),
    );
    expect(res.status).toBe(400);
  });

  itDb("malformed JSON body (valid signature) → 400", async () => {
    const raw = "not-json{";
    const secret = process.env.INGEST_HMAC_SECRET!;
    const signature = createHmac("sha256", secret).update(raw).digest("hex");
    const res = await app.handle(
      new Request(`http://localhost/api/ingest/${webhookMonitorId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-provider-event-id": "bad-json-1",
          "x-wirewatch-signature": signature,
        },
        body: raw,
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("classify() pure unit checks (no DB needed)", () => {
  it("clean payload classifies null", async () => {
    const { classifyEvent } = await import("../lib/classify");
    const monitor = {
      id: "m",
      tenantId: "t",
      name: "n",
      type: "webhook",
      schedule: null,
      graceSec: 0,
      contractSchema: { requiredFields: ["a"] },
      sanity: { maxAgeHours: 24 },
      status: "active",
      ingestSecretHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;
    expect(
      classifyEvent({ monitor, payload: { a: 1 }, receivedAt: new Date() }),
    ).toBeNull();
  });
});
