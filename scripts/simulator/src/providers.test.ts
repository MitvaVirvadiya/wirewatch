/**
 * Pure unit tests for the payload generators — no DB, no API. These pin the
 * provider shapes against the seeded contract_schema/sanity values so a
 * careless refactor can't silently make the demo "green" by never failing.
 */
import { describe, expect, it } from "bun:test";
import { generateEvents, type SimulatorMode } from "./providers";

const NOW = new Date("2026-10-16T06:00:00.000Z");

function eventsFor(mode: SimulatorMode) {
  return generateEvents(mode, NOW, "test-run");
}

function firstEvent(mode: SimulatorMode) {
  const [event] = eventsFor(mode);
  if (!event) throw new Error(`no events generated for mode ${mode}`);
  return event;
}

describe("simulator payload generators", () => {
  it("clean: all three monitors, every required field present", () => {
    const events = eventsFor("clean");
    expect(events.length).toBe(3);

    const nav = events.find((e) => e.monitorKey === "nav")!;
    for (const field of ["nav_file_id", "as_of_date", "sha256", "row_count"]) {
      expect(field in nav.payload).toBe(true);
    }
    expect(nav.payload["row_count"]).toBeGreaterThan(100);

    const webhook = events.find((e) => e.monitorKey === "webhook")!;
    for (const field of ["event_id", "type", "amount", "currency", "status"]) {
      expect(field in webhook.payload).toBe(true);
    }

    const poll = events.find((e) => e.monitorKey === "poll")!;
    for (const field of ["pair", "rate", "as_of"]) {
      expect(field in poll.payload).toBe(true);
    }
  });

  it("late: heartbeat scheduled 2h in the past (grace is 3600s)", () => {
    const event = firstEvent("late");
    expect(event).toBeDefined();
    expect(event.monitorKey).toBe("nav");
    const scheduledAt = new Date(String(event.payload["scheduled_at"]));
    expect(NOW.getTime() - scheduledAt.getTime()).toBe(7_200_000);
  });

  it("duplicate: the SAME providerEventId delivered twice, verbatim", () => {
    const events = eventsFor("duplicate");
    expect(events.length).toBe(2);
    expect(events[0]!.providerEventId).toBe(events[1]!.providerEventId);
    expect(events[0]!.payload).toEqual(events[1]!.payload);
  });

  it("drift: webhook payload missing amount/currency/status", () => {
    const event = firstEvent("drift");
    expect(event.monitorKey).toBe("webhook");
    expect("amount" in event.payload).toBe(false);
    expect("currency" in event.payload).toBe(false);
    expect("status" in event.payload).toBe(false);
    expect("event_id" in event.payload).toBe(true);
  });

  it("stale: poll as_of is 2h old", () => {
    const event = firstEvent("stale");
    expect(event.monitorKey).toBe("poll");
    const asOf = new Date(String(event.payload["as_of"]));
    expect(NOW.getTime() - asOf.getTime()).toBe(2 * 3_600_000);
  });

  it("partial: NAV row_count below the band floor (100)", () => {
    const event = firstEvent("partial");
    expect(event.monitorKey).toBe("nav");
    expect(event.payload["row_count"]).toBeLessThan(100);
  });
});
