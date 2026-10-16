/**
 * Monitors — the configured watch points (ADR-0001 product surface).
 *
 * type heartbeat: expect a signal every `schedule`; grace_sec is the
 *   allowed lateness before "late" escalates.
 * type webhook: provider pushes events to /api/ingest; `schedule` null.
 * type poll: we fetch the provider; `schedule` is the poll cadence.
 *
 * contract_schema (jsonb): expected shape of the payload — the
 *   classification pipeline (Phase 4) checks events against it.
 * sanity (jsonb): value-level rules (e.g. maxAgeHours, allowed ranges).
 */
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenancy";

export const monitorTypeEnum = pgEnum("monitor_type", [
  "heartbeat",
  "webhook",
  "poll",
] as const);

export const monitorStatusEnum = pgEnum("monitor_status", [
  "active",
  "paused",
] as const);

export const monitors = pgTable(
  "monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: monitorTypeEnum("type").notNull(),
    /** Cron-ish schedule; meaning depends on type (null for webhook). */
    schedule: text("schedule"),
    /** Allowed lateness before a heartbeat is "late". */
    graceSec: integer("grace_sec").notNull().default(300),
    contractSchema: jsonb("contract_schema"),
    sanity: jsonb("sanity"),
    status: monitorStatusEnum("status").notNull().default("active"),
    /** Per-monitor HMAC secret (hashed) — overrides INGEST_HMAC_SECRET (Phase 2b). */
    ingestSecretHash: text("ingest_secret_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("monitors_tenant_name_uq").on(t.tenantId, t.name),
    index("monitors_tenant_id_idx").on(t.tenantId),
  ],
);
