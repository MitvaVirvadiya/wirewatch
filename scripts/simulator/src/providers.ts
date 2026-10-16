/**
 * Pure payload generators — one per seeded monitor type, with a failure
 * knob per mode. Pure functions on (mode, now) so they are unit-testable
 * with zero IO (see providers.test.ts).
 *
 * Modes (MVP demo script, docs/product/mvp-scope.md):
 *   clean     — everything within contract + sanity
 *   late      — heartbeat file arrives 1h late (grace 3600s → late_file)
 *   duplicate — the SAME webhook event delivered twice (dedupe)
 *   drift     — webhook missing required fields (schema_drift)
 *   stale     — FX poll data 2h old (max 30min → stale_data)
 *   partial   — NAV file with row_count 12 (band floor 100 → partial_delivery)
 */
export type SimulatorMode =
  | "clean"
  | "late"
  | "duplicate"
  | "drift"
  | "stale"
  | "partial";

export const MONITOR_NAMES = {
  nav: "Daily NAV file drop",
  webhook: "Payments provider webhook",
  poll: "FX rates poll",
} as const;

export interface SimulatedEvent {
  monitorKey: "nav" | "webhook" | "poll";
  providerEventId: string;
  payload: Record<string, unknown>;
}

function iso(date: Date): string {
  return date.toISOString();
}

export function generateEvents(
  mode: SimulatorMode,
  now: Date,
  runId: string,
): SimulatedEvent[] {
  const stamp = now.getTime();

  const navEvent = (suffix: string, opts: { rowCount?: number; scheduledAt?: Date; asOf?: Date } = {}): SimulatedEvent => ({
    monitorKey: "nav",
    providerEventId: `nav-${runId}-${suffix}`,
    payload: {
      nav_file_id: `nav-${runId}-${suffix}`,
      as_of_date: iso(opts.asOf ?? now),
      sha256: "b".repeat(64),
      row_count: opts.rowCount ?? 5_000,
      ...(opts.scheduledAt ? { scheduled_at: iso(opts.scheduledAt) } : {}),
    },
  });

  const webhookEvent = (suffix: string, payload: Record<string, unknown>): SimulatedEvent => ({
    monitorKey: "webhook",
    providerEventId: `pay-${runId}-${suffix}`,
    payload: {
      event_id: `pay-${runId}-${suffix}`,
      type: "payment.settled",
      amount: "42.50",
      currency: "USD",
      status: "settled",
      as_of: iso(now),
      ...payload,
    },
  });

  const pollEvent = (opts: { asOf?: Date } = {}): SimulatedEvent => ({
    monitorKey: "poll",
    providerEventId: `fx-${runId}-${stamp}`,
    payload: {
      pair: "EUR/USD",
      rate: "1.0850",
      as_of: iso(opts.asOf ?? now),
    },
  });

  switch (mode) {
    case "clean":
      return [navEvent("0600", { scheduledAt: now }), webhookEvent("1", {}), pollEvent()];
    case "late":
      return [
        navEvent("late", { scheduledAt: new Date(stamp - 7_200_000), asOf: now }),
        // grace is 3600s → 2h lateness exceeds it → late_file
      ];
    case "duplicate": {
      const once = webhookEvent("dup", {});
      return [once, { ...once }]; // redelivered verbatim — same providerEventId
    }
    case "drift":
      // amount/currency/status missing → schema_drift
      return [
        {
          monitorKey: "webhook",
          providerEventId: `pay-${runId}-drift`,
          payload: { event_id: `pay-${runId}-drift`, type: "payment.settled" },
        },
      ];
    case "stale":
      return [pollEvent({ asOf: new Date(stamp - 2 * 3_600_000) })];
    case "partial":
      return [navEvent("partial", { rowCount: 12, scheduledAt: now })];
  }
}
