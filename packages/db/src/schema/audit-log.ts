/**
 * Audit log — every mutation worth explaining later (ADR-0005:
 * magic-link use, RBAC changes, monitor edits). Append-only: no
 * update/delete paths exist anywhere in the codebase.
 */
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenancy";

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** user id or 'system'. */
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_log_tenant_at_idx").on(t.tenantId, t.at)],
);
