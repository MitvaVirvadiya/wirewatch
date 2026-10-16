/**
 * Incidents + evidence links (Capability C: grouping).
 *
 * UNIQUE(fingerprint) on incidents is THE grouping target: the worker
 * upserts with ON CONFLICT (fingerprint) DO UPDATE occurrence_count+1,
 * last_seen=now(). A new fingerprint = new incident = alert job; an
 * existing one = silent count bump (alert-once via alerts.incident_id).
 *
 * NOTE: the unique is global per the data-model contract
 * (docs/architecture/overview.md). Therefore fingerprint strings MUST
 * embed tenant + monitor context (e.g.
 * sha256(tenant_id|monitor_id|failure_type|key-fields)) so different
 * tenants/monitors never collide on the same failure shape.
 *
 * incident_events is a pure link table between two tenant-scoped
 * parents, so it deliberately carries no tenant_id of its own.
 */
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { events } from "./events";
import { monitors } from "./monitors";
import { tenants } from "./tenancy";

export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "acknowledged",
  "resolved",
] as const);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** sha256(tenant|monitor|failure_type|key fields) — see file doc. */
    fingerprint: text("fingerprint").notNull(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    /** e.g. late_file | schema_drift | duplicate_webhook | stale_data | partial_delivery */
    failureType: text("failure_type").notNull(),
    status: incidentStatusEnum("status").notNull().default("open"),
    firstSeen: timestamp("first_seen", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .defaultNow()
      .notNull(),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    evidence: jsonb("evidence"),
  },
  (t) => [
    unique("incidents_fingerprint_uq").on(t.fingerprint),
    index("incidents_tenant_id_idx").on(t.tenantId),
    index("incidents_monitor_id_idx").on(t.monitorId),
    index("incidents_tenant_last_seen_idx").on(t.tenantId, t.lastSeen),
  ],
);

export const incidentEvents = pgTable(
  "incident_events",
  {
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.incidentId, t.eventId] }),
    index("incident_events_event_id_idx").on(t.eventId),
  ],
);
