/**
 * Tenancy core: tenants + memberships (ADR-0005 roles).
 *
 * Hard rule (HANDOFF §5): every tenant-owned table carries `tenant_id`
 * with FK + index. Multi-admin tenants and multi-tenant users are both
 * supported: memberships is many-to-many, roles are per-membership.
 */
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const roleEnum = pgEnum("role", [
  "owner",
  "admin",
  "member",
  "viewer",
] as const);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Stripe plan id (Phase 8); 'free' until billing lands. */
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("memberships_tenant_user_uq").on(t.tenantId, t.userId),
    index("memberships_tenant_id_idx").on(t.tenantId),
    index("memberships_user_id_idx").on(t.userId),
  ],
);
