/**
 * Tenancy helpers — the app-layer tenant scoping (threat-model control:
 * "withTenant() scoping + RBAC middleware", OQ-01 keeps RLS at Phase 9).
 *
 * Every tenant-scoped read goes through these — no route queries
 * monitors/incidents/etc. without a membership check.
 */
import { and, eq, inArray } from "drizzle-orm";
import { memberships, tenants } from "@wirewatch/db";
import { getDb } from "./deps";
import { getAuth } from "./auth";

export type Role = "owner" | "admin" | "member" | "viewer";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
}

/** null = not signed in (callers answer 401). */
export async function getSessionUser(
  request: Request,
): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

export interface MembershipInfo {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: Role;
}

/** All tenants the user belongs to (active-tenant switcher data). */
export async function listMemberships(
  userId: string,
): Promise<MembershipInfo[]> {
  const dbHandle = getDb();
  if (!dbHandle) throw new Error("database unavailable");
  const rows = await dbHandle.db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.userId, userId));
  return rows.map((row) => ({
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tenantSlug: row.tenantSlug,
    role: row.role as Role,
  }));
}

/** Tenant ids the user may see — the scope for every tenant-scoped query. */
export async function visibleTenantIds(userId: string): Promise<string[]> {
  return (await listMemberships(userId)).map((m) => m.tenantId);
}

/**
 * RBAC check: does the user hold one of `roles` in this tenant?
 * null = no (callers answer 403). Throws if tenant unknown.
 */
export async function membershipIn(
  tenantId: string,
  userId: string,
  roles?: Role[],
): Promise<Role | null> {
  const dbHandle = getDb();
  if (!dbHandle) throw new Error("database unavailable");
  const [row] = await dbHandle.db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.tenantId, tenantId),
        eq(memberships.userId, userId),
      ),
    );
  if (!row) return null;
  const role = row.role as Role;
  if (roles && !roles.includes(role)) return null;
  return role;
}

/** Guard helper for "user may see rows of these tenants" queries. */
export async function tenantsInScopeOrEmpty(
  userId: string,
): Promise<string[]> {
  const ids = await visibleTenantIds(userId);
  return ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
}

export { inArray };
