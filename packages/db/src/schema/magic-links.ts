/**
 * Magic links — scoped, expiring, read-only status sharing (ADR-0005).
 *
 * NOT an auth bypass, NOT a session: a token grants exactly one
 * resource view. Tokens are stored HASHED. Revocable. OQ-02 (open):
 * single-use vs multi-use-until-expiry — current ruling is multi-use
 * read-only, so single_use defaults false; the column exists so the
 * ruling can flip without a migration.
 */
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tenants } from "./tenancy";

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** 'incident' | 'monitor' — exactly one resource per link. */
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    singleUse: boolean("single_use").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("magic_links_tenant_id_idx").on(t.tenantId),
    index("magic_links_expires_at_idx").on(t.expiresAt),
  ],
);
