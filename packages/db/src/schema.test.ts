/**
 * Schema contract tests — no database needed; these assert the data
 * model CONTRACT (docs/architecture/overview.md "Data model sketch"),
 * especially the three Capability-A constraints. If someone drops or
 * renames one of these uniques, this file fails before any deploy does.
 */
import { describe, expect, it } from "bun:test";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import {
  account,
  alerts,
  auditLog,
  events,
  incidentEvents,
  incidents,
  magicLinks,
  memberships,
  monitors,
  session,
  tenants,
  user,
  verification,
} from "./schema";

function uniqueColumnSets(table: PgTable) {
  const config = getTableConfig(table);
  return [
    ...config.primaryKeys.map((pk) => pk.columns.map((c) => c.name).sort()),
    ...config.uniqueConstraints.map((uq) =>
      uq.columns.map((c) => c.name).sort(),
    ),
  ];
}

function hasColumn(table: PgTable, name: string) {
  return getTableConfig(table).columns.some((c) => c.name === name);
}

describe("schema: all contract tables exist with key columns", () => {
  it("tenancy + better-auth core", () => {
    expect(hasColumn(tenants, "slug")).toBe(true);
    expect(hasColumn(memberships, "tenant_id")).toBe(true);
    expect(hasColumn(memberships, "role")).toBe(true);
    for (const t of [user, session, account, verification]) {
      expect(getTableConfig(t).name.length).toBeGreaterThan(0);
    }
    expect(hasColumn(user, "email_verified")).toBe(true);
    expect(hasColumn(session, "expires_at")).toBe(true);
    expect(hasColumn(account, "provider_id")).toBe(true);
    expect(hasColumn(verification, "identifier")).toBe(true);
  });

  it("monitors/events/incidents/alerts/magic_links/audit_log", () => {
    expect(hasColumn(monitors, "contract_schema")).toBe(true);
    expect(hasColumn(monitors, "grace_sec")).toBe(true);
    expect(hasColumn(events, "provider_event_id")).toBe(true);
    expect(hasColumn(incidents, "fingerprint")).toBe(true);
    expect(hasColumn(incidents, "occurrence_count")).toBe(true);
    expect(hasColumn(incidentEvents, "incident_id")).toBe(true);
    expect(hasColumn(alerts, "incident_id")).toBe(true);
    expect(hasColumn(magicLinks, "token_hash")).toBe(true);
    expect(hasColumn(auditLog, "actor")).toBe(true);
  });
});

describe("schema: Capability-A constraints (the whole point)", () => {
  it("events: UNIQUE(monitor_id, provider_event_id) — ingestion dedupe", () => {
    expect(uniqueColumnSets(events)).toContainEqual([
      "monitor_id",
      "provider_event_id",
    ]);
  });

  it("incidents: UNIQUE(fingerprint) — grouping upsert target", () => {
    expect(uniqueColumnSets(incidents)).toContainEqual(["fingerprint"]);
  });

  it("alerts: UNIQUE(incident_id) — alert-once", () => {
    expect(uniqueColumnSets(alerts)).toContainEqual(["incident_id"]);
  });
});

describe("schema: tenant_id on every tenant-owned table", () => {
  // `tenants` itself is the root (a tenant_id FK to itself would be circular).
  const tenantOwned = [
    memberships,
    monitors,
    events,
    incidents,
    alerts,
    magicLinks,
    auditLog,
  ];

  it.each(tenantOwned.map((t) => [getTableConfig(t).name, t] as const))(
    "%s carries tenant_id",
    (_name, table) => {
      expect(hasColumn(table, "tenant_id")).toBe(true);
    },
  );

  it("incident_events is a pure link table (tenant via parents) — documented exception", () => {
    expect(hasColumn(incidentEvents, "tenant_id")).toBe(false);
    expect(hasColumn(incidentEvents, "incident_id")).toBe(true);
    expect(hasColumn(incidentEvents, "event_id")).toBe(true);
  });
});
