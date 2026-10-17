/**
 * Invite flow (ADR-0005): tenant owner/admin creates a user account +
 * membership. The temp password is delivered via the console-log email
 * adapter in dev (mvp-scope sanctioned; Resend later) and — local/test
 * ONLY — echoed in the response so the demo/tests can sign in.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { auditLog, memberships, user } from "@wirewatch/db";
import { env } from "../env";
import { getAuth } from "../lib/auth";
import { getDb } from "../lib/deps";
import { getSessionUser, membershipIn, type Role } from "../lib/tenancy";

const ROLES: Role[] = ["owner", "admin", "member", "viewer"];

export const inviteRoutes = new Elysia({ prefix: "/api/invites" }).post(
  "/",
  async ({ body, request, set }) => {
    const session = await getSessionUser(request);
    if (!session) {
      set.status = 401;
      return { ok: false, error: "authentication required" };
    }

    const input = body as {
      email?: string;
      name?: string;
      role?: string;
      tenantId?: string;
    };
    const email = input.email?.trim().toLowerCase();
    const role = input.role as Role | undefined;
    const tenantId = input.tenantId;

    if (!email || !email.includes("@") || !tenantId || !role || !ROLES.includes(role)) {
      set.status = 400;
      return {
        ok: false,
        error: `required: email, tenantId, role (${ROLES.join("|")})`,
      };
    }

    // RBAC: inviter must be owner/admin of the target tenant.
    const inviterRole = await membershipIn(tenantId, session.userId, [
      "owner",
      "admin",
    ]);
    if (!inviterRole) {
      set.status = 403;
      return {
        ok: false,
        error: `only tenant owner/admin can invite (you are ${inviterRole ?? "not a member"})`,
      };
    }

    const dbHandle = getDb();
    if (!dbHandle) {
      set.status = 503;
      return { ok: false, error: "database unavailable" };
    }
    const { db } = dbHandle;

    // Existing user? Just attach the membership. New? Create via better-auth
    // server-side (proper password hashing + account row).
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));

    let userId: string;
    let tempPassword: string | null = null;
    if (existing) {
      userId = existing.id;
    } else {
      tempPassword = randomBytes(9).toString("base64url"); // 12 chars, >= min 8
      const created = await getAuth().api.signUpEmail({
        body: {
          email,
          password: tempPassword,
          name: input.name ?? email.split("@")[0]!,
        },
      });
      userId = created.user.id;
    }

    const inserted = await db
      .insert(memberships)
      .values({ tenantId, userId, role })
      .onConflictDoNothing({ target: [memberships.tenantId, memberships.userId] })
      .returning({ id: memberships.id });

    if (inserted.length === 0) {
      set.status = 409;
      return { ok: false, error: "user is already a member of this tenant" };
    }

    await db.insert(auditLog).values({
      tenantId,
      actor: session.userId,
      action: "invite_user",
      after: { email, role, userId },
    });

    // ── dev email adapter: console.log ────────────────────────────────
    console.log(
      `[invite:email→console] ${email} invited to tenant ${tenantId} as ${role} ` +
        `by ${session.email}${tempPassword ? ` — temp password: ${tempPassword}` : " (existing user)"}`,
    );

    set.status = 201;
    return {
      ok: true,
      userId,
      tenantId,
      role,
      // Local/test only so the demo + integration tests can sign in —
      // staging/production users get the temp password via real email only.
      ...(tempPassword && env.isLocal ? { tempPassword } : {}),
    };
  },
);
