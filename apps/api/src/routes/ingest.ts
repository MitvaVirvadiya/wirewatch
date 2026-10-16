/**
 * Signed ingestion endpoint — Capability A spike (Phase 2b).
 *
 *   POST /api/ingest/:monitorId
 *   Headers:
 *     x-provider-event-id  — provider's idempotency key (dedupe identity)
 *     x-wirewatch-signature — hex(HMAC-SHA256(rawBody, secret))
 *
 * Contract (docs/architecture/overview.md "Data flow"):
 *   1. Verify signature (constant-time compare; fail closed).
 *   2. INSERT event ON CONFLICT (monitor_id, provider_event_id) DO NOTHING
 *      → 202 either way; duplicate flagged + audited (this is the dedupe).
 *   3. Classify (spike: synchronous; Phase 4 moves it to the queue/worker).
 *      Failure → upsert incident on UNIQUE(fingerprint) (count+1, last_seen).
 *      New incident → alert-once via UNIQUE(incident_id) on alerts.
 *
 * Secret: INGEST_HMAC_SECRET (read lazily per request, so tests and
 * `--watch` restarts pick up env changes). Per-monitor secret note: the
 * schema stores ingest_secret_hash, but an HMAC cannot be verified against
 * a one-way hash of the key — per-monitor secrets need reversible storage
 * (encrypted) — open question for Phase 3; v1 uses the env secret.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import {
  auditLog,
  events,
  incidentEvents,
  incidents,
  monitors,
} from "@wirewatch/db";
import { alertOnceOnNewIncident } from "../lib/alerts";
import { classifyEvent, incidentFingerprint } from "../lib/classify";
import { getDb } from "../lib/deps";

const SIGNATURE_HEADER = "x-wirewatch-signature";
const PROVIDER_EVENT_ID_HEADER = "x-provider-event-id";

function ingestSecret(): string | null {
  return process.env.INGEST_HMAC_SECRET ?? null;
}

function validSignature(
  rawBody: string,
  provided: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const ingestRoutes = new Elysia({ prefix: "/api/ingest" }).post(
  "/:monitorId",
  async ({ params, request, set }) => {
    const monitorId = params.monitorId;

    // 0. Fail closed if no secret configured.
    const secret = ingestSecret();
    if (!secret) {
      set.status = 500;
      return { ok: false, error: "ingest secret not configured" };
    }

    // 1. Load monitor (404 on unknown).
    const dbHandle = getDb();
    if (!dbHandle) {
      set.status = 503;
      return { ok: false, error: "database unavailable" };
    }
    const { db } = dbHandle;
    const [monitor] = await db
      .select()
      .from(monitors)
      .where(eq(monitors.id, monitorId));
    if (!monitor) {
      set.status = 404;
      return { ok: false, error: "unknown monitor" };
    }

    // 2. Verify signature against the RAW body (never the re-serialized one).
    const rawBody = await request.text();
    const signature = request.headers.get(SIGNATURE_HEADER) ?? "";
    if (!signature || !validSignature(rawBody, signature, secret)) {
      set.status = 401;
      return { ok: false, error: "invalid signature" };
    }

    // 3. Parse payload + read the provider's idempotency key.
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      set.status = 400;
      return { ok: false, error: "body is not valid JSON" };
    }
    const providerEventId = request.headers.get(PROVIDER_EVENT_ID_HEADER) ?? "";
    if (!providerEventId) {
      set.status = 400;
      return { ok: false, error: `missing ${PROVIDER_EVENT_ID_HEADER}` };
    }

    // 4. Dedupe: the database is the last line of defense.
    const inserted = await db
      .insert(events)
      .values({
        tenantId: monitor.tenantId,
        monitorId: monitor.id,
        providerEventId,
        payload,
      })
      .onConflictDoNothing({ target: [events.monitorId, events.providerEventId] })
      .returning({ id: events.id });

    if (inserted.length === 0) {
      // Duplicate delivery — flag, audit, and answer 202 (per the contract).
      await db.insert(auditLog).values({
        tenantId: monitor.tenantId,
        actor: "system",
        action: "duplicate_webhook",
        after: { monitorId: monitor.id, providerEventId },
      });
      set.status = 202;
      return { ok: true, duplicate: true, monitorId: monitor.id };
    }
    const event = inserted[0]!;

    // 5. Classify (spike — synchronous; Phase 4: enqueue instead).
    const receivedAt = new Date();
    const failure = classifyEvent({ monitor, payload, receivedAt });

    if (failure) {
      const fingerprint = incidentFingerprint(
        monitor.tenantId,
        monitor.id,
        failure.failureType,
      );
      const incidentRows = await db
        .insert(incidents)
        .values({
          tenantId: monitor.tenantId,
          fingerprint,
          monitorId: monitor.id,
          failureType: failure.failureType,
          status: "open",
          firstSeen: receivedAt,
          lastSeen: receivedAt,
          occurrenceCount: 1,
          evidence: { reason: failure.reason, sampleEventId: event.id },
        })
        .onConflictDoUpdate({
          target: incidents.fingerprint,
          set: {
            lastSeen: receivedAt,
            occurrenceCount: sql`${incidents.occurrenceCount} + 1`,
          },
        })
        .returning({
          id: incidents.id,
          occurrenceCount: incidents.occurrenceCount,
          status: incidents.status,
        });
      const incident = incidentRows[0]!;

      await db
        .insert(incidentEvents)
        .values({ incidentId: incident.id, eventId: event.id })
        .onConflictDoNothing();

      const isNew =
        incident.occurrenceCount === 1 && incident.status === "open";
      if (isNew) {
        await alertOnceOnNewIncident({
          db,
          tenantId: monitor.tenantId,
          monitorId: monitor.id,
          incidentId: incident.id,
          failureType: failure.failureType,
          reason: failure.reason,
        });
      }

      set.status = 202;
      return {
        ok: true,
        duplicate: false,
        monitorId: monitor.id,
        incident: {
          id: incident.id,
          failureType: failure.failureType,
          occurrenceCount: incident.occurrenceCount,
          new: isNew,
        },
      };
    }

    // Clean event — stored, nothing to raise.
    set.status = 202;
    return { ok: true, duplicate: false, monitorId: monitor.id };
  },
);
