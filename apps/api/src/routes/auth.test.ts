/**
 * Auth integration tests — require Postgres (skip otherwise, same pattern
 * as ingest.test.ts). These prove the ADR-0005 contract end-to-end:
 * invite-only (sign-up blocked), sign-in, invite flow with RBAC,
 * session-scoped reads, and the cross-tenant isolation attack from the
 * threat model.
 */
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { monitors, tenants } from "@wirewatch/db";
import { getAuth } from "../lib/auth";
import { getDb } from "../lib/deps";

process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-0123456789";
process.env.INGEST_HMAC_SECRET ??= "test-ingest-secret";

const app = new Elysia()
  .use((await import("./auth")).authRoutes)
  .use((await import("./invites")).inviteRoutes)
  .use((await import("./scoped")).scopedRoutes);

const dbHandle = getDb();

let dbAvailable = false;
if (dbHandle) {
  try {
    await Promise.race([
      dbHandle.db.execute((await import("drizzle-orm")).sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("probe timeout")), 3_000),
      ),
    ]);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
}
const itDb: typeof it = dbAvailable ? it : it.skip;

// ── Fixture: two tenants (A/B) + monitors + an owner user ──────────────
const OWNER_EMAIL = `owner-${Date.now()}@auth-test.dev`;
const OWNER_PASSWORD = "owner-password-123";
const MEMBER_EMAIL = `member-${Date.now()}@auth-test.dev`;
let memberTempPassword = "";
let tenantAId = "";
let tenantBId = "";

if (dbAvailable && dbHandle) {
  const { db } = dbHandle;
  const created = await db
    .insert(tenants)
    .values([
      { name: "Auth Test A", slug: `auth-test-a-${Date.now()}` },
      { name: "Auth Test B", slug: `auth-test-b-${Date.now()}` },
    ])
    .returning({ id: tenants.id, name: tenants.name });
  tenantAId = created.find((t) => t.name === "Auth Test A")!.id;
  tenantBId = created.find((t) => t.name === "Auth Test B")!.id;

  await db.insert(monitors).values([
    {
      tenantId: tenantAId,
      name: "A webhook",
      type: "webhook",
      contractSchema: { requiredFields: ["event_id"] },
    },
    {
      tenantId: tenantBId,
      name: "B webhook",
      type: "webhook",
      contractSchema: { requiredFields: ["event_id"] },
    },
  ]);

  // The first account can't come from the (blocked) public flow — create it
  // server-side, exactly like the dev bootstrap script does.
  await getAuth().api.signUpEmail({
    body: { email: OWNER_EMAIL, password: OWNER_PASSWORD, name: "Test Owner" },
  });
}

afterAll(async () => {
  if (dbAvailable && dbHandle && tenantAId && tenantBId) {
    await dbHandle.db.delete(tenants).where(eq(tenants.id, tenantAId));
    await dbHandle.db.delete(tenants).where(eq(tenants.id, tenantBId));
  }
  // NOTE: no shutdownDeps() — same reasoning as ingest.test.ts (shared pool).
});

// Owner membership for tenant A (done here, like dev-admin does).
if (dbAvailable && dbHandle && tenantAId) {
  const { memberships, user } = await import("@wirewatch/db");
  const [ownerRow] = await dbHandle.db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, OWNER_EMAIL));
  await dbHandle.db
    .insert(memberships)
    .values({ tenantId: tenantAId, userId: ownerRow!.id, role: "owner" })
    .onConflictDoNothing({ target: [memberships.tenantId, memberships.userId] });
}

// ── Helpers ─────────────────────────────────────────────────────────────
async function signIn(email: string, password: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  const cookies = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]!)
    .join("; ");
  return cookies;
}

function authed(path: string, cookie: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });
}

// ── Tests ───────────────────────────────────────────────────────────────
describe("auth: invite-only (ADR-0005)", () => {
  itDb("public sign-up is blocked at the HTTP layer → 403", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: `walkin-${Date.now()}@auth-test.dev`,
          password: "walkin-password-1",
          name: "Walk In",
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  itDb("owner sign-in → 200 + session cookie", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().length).toBeGreaterThan(0);
  });

  itDb("wrong password → 401", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: OWNER_EMAIL, password: "wrong-password" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  itDb("GET /api/me with cookie → user + owner membership; without → 401", async () => {
    const cookie = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
    expect(cookie.length).toBeGreaterThan(0);

    const authedRes = await app.handle(authed("/api/me", cookie));
    expect(authedRes.status).toBe(200);
    const meBody = (await authedRes.json()) as {
      user: { email: string };
      memberships: { tenantId: string; role: string }[];
    };
    expect(meBody.user.email).toBe(OWNER_EMAIL);
    const own = meBody.memberships.find((m) => m.tenantId === tenantAId);
    expect(own?.role).toBe("owner");

    const anonRes = await app.handle(new Request("http://localhost/api/me"));
    expect(anonRes.status).toBe(401);
  });

  itDb("invite by owner → 201 + temp password (local) + membership; sign-in works", async () => {
    const cookie = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
    const res = await app.handle(
      authed("/api/invites", cookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: MEMBER_EMAIL,
          role: "viewer",
          tenantId: tenantAId,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { tempPassword?: string };
    expect(typeof body.tempPassword).toBe("string"); // local/test only
    memberTempPassword = body.tempPassword!;

    const memberCookie = await signIn(MEMBER_EMAIL, memberTempPassword);
    expect(memberCookie.length).toBeGreaterThan(0);
  });

  itDb(
    "CROSS-TENANT ISOLATION (threat model): tenant-A member sees only tenant-A monitors",
    async () => {
      expect(memberTempPassword).not.toBe(""); // set by the invite test above
      const memberCookie = await signIn(MEMBER_EMAIL, memberTempPassword);
      const res = await app.handle(authed("/api/monitors", memberCookie));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        monitors: { tenantId: string; name: string }[];
      };
      const names = body.monitors.map((m) => m.name);
      expect(names).toContain("A webhook");
      expect(names).not.toContain("B webhook"); // THE isolation guarantee
      for (const m of body.monitors) {
        expect(m.tenantId).toBe(tenantAId);
      }
    },
  );

  itDb("invite by viewer → 403 (RBAC)", async () => {
    const ownerCookie = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
    const viewerEmail = `viewer2-${Date.now()}@auth-test.dev`;
    const res = await app.handle(
      authed("/api/invites", ownerCookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: viewerEmail, role: "viewer", tenantId: tenantAId }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { tempPassword?: string };
    const viewerCookie = await signIn(viewerEmail, body.tempPassword!);
    expect(viewerCookie.length).toBeGreaterThan(0);

    // The viewer tries to invite someone else → must be denied.
    const attempt = await app.handle(
      authed("/api/invites", viewerCookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: `victim-${Date.now()}@auth-test.dev`,
          role: "member",
          tenantId: tenantAId,
        }),
      }),
    );
    expect(attempt.status).toBe(403);
  });

  itDb("unauthenticated invite → 401", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "x@x.dev", role: "viewer", tenantId: tenantAId }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
