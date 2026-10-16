/**
 * Classification spike (Phase 2b) — deliberately synchronous.
 *
 * The real pipeline (Phase 4) moves this to the queue/worker so the API
 * can answer <100ms with zero heavy work in the request path. For the
 * spike the checks are tiny (in-memory JSON checks), which keeps the
 * request fast enough for the local demo while proving the full flow:
 * ingest → dedupe → classify → fingerprint → group → alert-once.
 *
 * Inputs come straight from the monitor's `contract_schema` and `sanity`
 * columns (the seeded shape):
 *   contract_schema.requiredFields: string[]  → schema_drift if any missing
 *   sanity.maxAgeHours: number                → stale_data if payload as_of older
 *   monitor.graceSec + payload.scheduled_at   → late_file if lateness exceeds grace
 */
import { createHash } from "node:crypto";
import type { InferSelectModel } from "drizzle-orm";
import type { monitors } from "@wirewatch/db";

export type MonitorRow = InferSelectModel<typeof monitors>;

export type FailureType =
  | "schema_drift"
  | "stale_data"
  | "late_file"
  | "partial_delivery";

export interface ClassificationFailure {
  failureType: FailureType;
  reason: string;
}

interface ContractSchema {
  requiredFields?: string[];
}

interface SanityRules {
  maxAgeHours?: number;
  /** Alias used by poll monitors (30 → 0.5h). */
  maxStalenessMinutes?: number;
  /** Record-count band floor → partial_delivery. */
  minRowCount?: number;
}

/** Extract the "as of" instant from provider-shaped payloads (snake_case variants). */
function payloadAsOf(payload: Record<string, unknown>): Date | null {
  for (const key of ["as_of", "asOf", "as_of_date"]) {
    const value = payload[key];
    if (typeof value === "string") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

function payloadScheduledAt(payload: Record<string, unknown>): Date | null {
  const value = payload["scheduled_at"] ?? payload["scheduledAt"];
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function classifyEvent(input: {
  monitor: MonitorRow;
  payload: unknown;
  receivedAt: Date;
}): ClassificationFailure | null {
  const { monitor, receivedAt } = input;
  if (typeof input.payload !== "object" || input.payload === null) {
    return { failureType: "schema_drift", reason: "payload is not a JSON object" };
  }
  const payload = input.payload as Record<string, unknown>;

  // 1. Contract check — every required field present (schema_drift).
  const contract = (monitor.contractSchema ?? {}) as ContractSchema;
  const missing = (contract.requiredFields ?? []).filter(
    (field) => !(field in payload),
  );
  if (missing.length > 0) {
    return {
      failureType: "schema_drift",
      reason: `missing required fields: ${missing.join(", ")}`,
    };
  }

  // 2. Sanity — record-count band (partial_delivery).
  const sanity = (monitor.sanity ?? {}) as SanityRules;
  const rowCount = payload["row_count"];
  if (
    sanity.minRowCount !== undefined &&
    typeof rowCount === "number" &&
    rowCount < sanity.minRowCount
  ) {
    return {
      failureType: "partial_delivery",
      reason: `row_count ${rowCount} below band floor ${sanity.minRowCount}`,
    };
  }

  // 3. Sanity — data age (stale_data).
  const maxAgeHours =
    sanity.maxAgeHours ??
    (sanity.maxStalenessMinutes !== undefined
      ? sanity.maxStalenessMinutes / 60
      : undefined);
  const asOf = payloadAsOf(payload);
  if (maxAgeHours !== undefined && asOf) {
    const ageHours = (receivedAt.getTime() - asOf.getTime()) / 3_600_000;
    if (ageHours > maxAgeHours) {
      return {
        failureType: "stale_data",
        reason: `data age ${ageHours.toFixed(1)}h exceeds maxAgeHours ${maxAgeHours}`,
      };
    }
  }

  // 4. Heartbeat lateness vs grace period (late_file).
  if (monitor.type === "heartbeat") {
    const scheduledAt = payloadScheduledAt(payload);
    if (scheduledAt) {
      const lateSec = (receivedAt.getTime() - scheduledAt.getTime()) / 1_000;
      if (lateSec > monitor.graceSec) {
        return {
          failureType: "late_file",
          reason: `arrived ${Math.round(lateSec)}s after schedule; grace is ${monitor.graceSec}s`,
        };
      }
    }
  }

  return null;
}

/**
 * Grouping fingerprint — MUST embed tenant + monitor context because
 * incidents.fingerprint is UNIQUE globally (see schema/incidents.ts doc).
 */
export function incidentFingerprint(
  tenantId: string,
  monitorId: string,
  failureType: string,
): string {
  return createHash("sha256")
    .update(`${tenantId}|${monitorId}|${failureType}`)
    .digest("hex");
}
