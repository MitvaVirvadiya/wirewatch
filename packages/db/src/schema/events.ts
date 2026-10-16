/**
 * Events — raw provider signals (Capability A: reliable ingestion).
 *
 * UNIQUE(monitor_id, provider_event_id) is THE dedupe constraint: the
 * ingestion endpoint does INSERT ... ON CONFLICT DO NOTHING against it,
 * so a redelivered webhook can never create a second event row. This
 * is the "the database is the last line of defense" anchor — see
 * docs/learning/ when Phase 3 lands.
 */
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { monitors } from "./monitors";
import { tenants } from "./tenancy";

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    /** Provider's own idempotency key / event id. */
    providerEventId: text("provider_event_id").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("events_monitor_provider_uq").on(t.monitorId, t.providerEventId),
    index("events_tenant_id_idx").on(t.tenantId),
    index("events_monitor_received_idx").on(t.monitorId, t.receivedAt),
  ],
);
