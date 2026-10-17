/**
 * Session-scoped tenant reads for the dashboard — the tenant-isolation
 * surface: every query is membership-scoped (visibleTenantIds), never a
 * bare "select all" (threat-model control; cross-tenant attack tested).
 *
 * CORS: browser (web origin) → API cross-origin with credentials; better-auth
 * handles CORS for /api/auth/* via trustedOrigins, these routes handle their
 * own preflight + headers.
 */
import { desc, eq, inArray, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { incidents, monitors } from "@wirewatch/db";
import { getDb } from "../lib/deps";
import {
  getSessionUser,
  listMemberships,
  tenantsInScopeOrEmpty,
} from "../lib/tenancy";

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3100";

/** CORS headers for the browser (web origin) → API cross-origin credentialed fetches. */
function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": WEB_ORIGIN,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    vary: "Origin",
  };
}

export const scopedRoutes = new Elysia({ prefix: "/api" })
  // ── Preflight for the browser routes below ─────────────────────────
  .options("/me", ({ set }) => {
    Object.assign(set.headers, corsHeaders());
    set.status = 204;
    return "";
  })
  .options("/monitors", ({ set }) => {
    Object.assign(set.headers, corsHeaders());
    set.status = 204;
    return "";
  })
  .options("/incidents", ({ set }) => {
    Object.assign(set.headers, corsHeaders());
    set.status = 204;
    return "";
  })
  .get("/me", async ({ request, set }) => {
    Object.assign(set.headers, corsHeaders());
    const session = await getSessionUser(request);
    if (!session) {
      set.status = 401;
      return { ok: false, error: "authentication required" };
    }
    return {
      ok: true,
      user: session,
      memberships: await listMemberships(session.userId),
    };
  })
  .get("/monitors", async ({ request, set }) => {
    Object.assign(set.headers, corsHeaders());
    const session = await getSessionUser(request);
    if (!session) {
      set.status = 401;
      return { ok: false, error: "authentication required" };
    }
    const dbHandle = getDb();
    if (!dbHandle) {
      set.status = 503;
      return { ok: false, error: "database unavailable" };
    }
    const scope = await tenantsInScopeOrEmpty(session.userId); // empty → uuid-nil → no rows
    const rows = await dbHandle.db
      .select({
        id: monitors.id,
        tenantId: monitors.tenantId,
        name: monitors.name,
        type: monitors.type,
        status: monitors.status,
        schedule: monitors.schedule,
        graceSec: monitors.graceSec,
      })
      .from(monitors)
      .where(inArray(monitors.tenantId, scope))
      .orderBy(monitors.name);
    return { ok: true, monitors: rows };
  })
  .get("/incidents", async ({ request, set }) => {
    Object.assign(set.headers, corsHeaders());
    const session = await getSessionUser(request);
    if (!session) {
      set.status = 401;
      return { ok: false, error: "authentication required" };
    }
    const dbHandle = getDb();
    if (!dbHandle) {
      set.status = 503;
      return { ok: false, error: "database unavailable" };
    }
    const scope = await tenantsInScopeOrEmpty(session.userId);
    const rows = await dbHandle.db
      .select({
        id: incidents.id,
        tenantId: incidents.tenantId,
        monitorId: incidents.monitorId,
        failureType: incidents.failureType,
        status: incidents.status,
        occurrenceCount: incidents.occurrenceCount,
        firstSeen: incidents.firstSeen,
        lastSeen: incidents.lastSeen,
      })
      .from(incidents)
      .where(inArray(incidents.tenantId, scope))
      .orderBy(desc(incidents.lastSeen))
      .limit(50);
    return {
      ok: true,
      incidents: rows.map((row) => ({
        ...row,
        firstSeen: row.firstSeen.toISOString(),
        lastSeen: row.lastSeen.toISOString(),
      })),
    };
  });
