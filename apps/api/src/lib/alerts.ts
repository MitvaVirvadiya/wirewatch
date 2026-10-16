/**
 * Alert-once (Capability C anchor) + the dev email adapter.
 *
 * `UNIQUE(incident_id)` on alerts is the "exactly one alert per incident"
 * guard: insert with ON CONFLICT DO NOTHING — if the row exists, the alert
 * already went out (even if a future queue redelivers the job).
 *
 * Email adapter: console-log in dev (mvp-scope explicitly allows
 * "console-log adapter in dev"); Resend lands later. The adapter boundary
 * is this one function, so the swap is one-file later.
 */
import type { DbHandle } from "@wirewatch/db";
import { alerts, incidents } from "@wirewatch/db";

export interface AlertOnCreateInput {
  db: DbHandle["db"];
  tenantId: string;
  monitorId: string;
  incidentId: string;
  failureType: string;
  reason: string;
}

/** Returns true if this call is the one that sent the alert (first failure). */
export async function alertOnceOnNewIncident(
  input: AlertOnCreateInput,
): Promise<boolean> {
  const inserted = await input.db
    .insert(alerts)
    .values({
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      channel: "email",
      details: {
        adapter: "console-log(dev)",
        failureType: input.failureType,
        reason: input.reason,
      },
    })
    .onConflictDoNothing({ target: alerts.incidentId })
    .returning({ id: alerts.id });

  if (inserted.length === 0) return false; // already alerted — silence

  // ── dev email adapter: console.log ────────────────────────────────────
  console.log(
    `[alert:email→console] NEW incident ${input.incidentId} on monitor ${input.monitorId} ` +
      `[${input.failureType}] ${input.reason} — tenant ${input.tenantId}`,
  );
  return true;
}

/** Incident title line for alert bodies (used by later adapters). */
export function alertSubjectLine(incident: {
  failureType: string;
  status: typeof incidents.$inferSelect.status;
  occurrenceCount: number;
}): string {
  return `Wirewatch: ${incident.failureType} incident ${incident.status} (${incident.occurrenceCount} occurrences)`;
}
