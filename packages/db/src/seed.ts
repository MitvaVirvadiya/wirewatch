/**
 * Seed — `bun --filter @wirewatch/db run seed`.
 *
 * ONE dev tenant + 3 monitors (one per monitor type) so Phase 2b's
 * simulator has real targets. Idempotent: re-running is a no-op.
 *
 * Guard: localhost/CI only — never runs against staging/production
 * (threat model: seed data in prod is a tenant-isolation incident).
 */
import { eq } from "drizzle-orm";
import { createDb, resolveDatabaseUrl } from "./client";
import { monitors, tenants } from "./schema";

const appEnv = (process.env.APP_ENV ?? "local") as string;
if (appEnv === "staging" || appEnv === "production") {
  throw new Error(`[db] seed refuses to run when APP_ENV=${appEnv}`);
}

const { db, sql } = createDb(resolveDatabaseUrl());

const DEV_TENANT_SLUG = "dev-financial";

await db
  .insert(tenants)
  .values({
    name: "Dev Financial (synthetic)",
    slug: DEV_TENANT_SLUG,
    plan: "free",
  })
  .onConflictDoNothing({ target: tenants.slug });

const [tenant] = await db
  .select()
  .from(tenants)
  .where(eq(tenants.slug, DEV_TENANT_SLUG));
if (!tenant) throw new Error("[db] seed failed to find/create dev tenant");

await db
  .insert(monitors)
  .values([
    {
      tenantId: tenant.id,
      name: "Daily NAV file drop",
      type: "heartbeat",
      schedule: "0 6 * * *",
      graceSec: 3600,
      contractSchema: {
        requiredFields: ["nav_file_id", "as_of_date", "sha256", "row_count"],
      },
      sanity: { maxAgeHours: 26, minRowCount: 100 },
    },
    {
      tenantId: tenant.id,
      name: "Payments provider webhook",
      type: "webhook",
      schedule: null,
      graceSec: 0,
      contractSchema: {
        requiredFields: ["event_id", "type", "amount", "currency", "status"],
      },
      sanity: { maxPayloadBytes: 65536 },
    },
    {
      tenantId: tenant.id,
      name: "FX rates poll",
      type: "poll",
      schedule: "*/15 * * * *",
      graceSec: 300,
      contractSchema: { requiredFields: ["pair", "rate", "as_of"] },
      sanity: { maxStalenessMinutes: 30 },
    },
  ])
  .onConflictDoNothing({ target: [monitors.tenantId, monitors.name] });

const seededMonitors = await db
  .select()
  .from(monitors)
  .where(eq(monitors.tenantId, tenant.id));

console.log(`[db] seed ok — tenant: ${tenant.name} (${tenant.slug})`);
for (const m of seededMonitors) {
  console.log(
    `[db]   monitor: ${m.name} [type=${m.type} status=${m.status} grace=${m.graceSec}s]`,
  );
}

await sql.end();
