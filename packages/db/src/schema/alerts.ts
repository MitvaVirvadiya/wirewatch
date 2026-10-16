/**
 * Alerts (Capability C: alert-once).
 *
 * UNIQUE(incident_id) is the "alert exactly once per incident" guard:
 * the alert worker inserts here with ON CONFLICT DO NOTHING; if the row
 * exists, the alert already went out and we skip — the DB enforces it
 * even if the queue redelivers the job.
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
import { incidents } from "./incidents";
import { tenants } from "./tenancy";

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    /** e.g. email (Phase 4); slack/webhook channels later. */
    channel: text("channel").notNull().default("email"),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    details: jsonb("details"),
  },
  (t) => [
    unique("alerts_incident_id_uq").on(t.incidentId),
    index("alerts_tenant_id_idx").on(t.tenantId),
  ],
);
