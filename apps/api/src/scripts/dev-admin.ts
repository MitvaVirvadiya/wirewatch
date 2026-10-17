/**
 * Dev founder bootstrap — `bun run --filter @wirewatch/api seed:admin`
 *
 * Creates (idempotently) the FIRST user of the seeded dev tenant
 * (`dev-financial`) with an owner membership — the chicken/egg breaker
 * for the invite-only system: accounts only come from invites, and the
 * first account can't be invited by anyone.
 *
 * Local/test ONLY (threat model: seed surfaces never exist in staging/prod).
 * Credentials: email from --email or FOUNDER_EMAIL, password from
 * --password or FOUNER_PASSWORD, else dev defaults (printed to console).
 */
import { eq } from "drizzle-orm";
import { memberships, tenants, user } from "@wirewatch/db";
import { env } from "../env";
import { getAuth } from "../lib/auth";
import { getDb, shutdownDeps } from "../lib/deps";

if (!env.isLocal) {
  throw new Error(`[seed:admin] refuses to run when APP_ENV=${env.appEnv}`);
}

const args = new Map<string, string>();
for (let i = 0; i < process.argv.length - 1; i++) {
  if (process.argv[i]?.startsWith("--")) {
    args.set(process.argv[i]!.slice(2), process.argv[i + 1] ?? "");
  }
}

const email = (
  args.get("email") ??
  process.env.FOUNDER_EMAIL ??
  "founder@wirewatch.dev"
).toLowerCase();
const password = args.get("password") ?? "founder-dev-password";
const tenantSlug = "dev-financial";

const dbHandle = getDb();
if (!dbHandle) throw new Error("[seed:admin] DATABASE_URL required");
const { db } = dbHandle;

const [tenant] = await db
  .select()
  .from(tenants)
  .where(eq(tenants.slug, tenantSlug));
if (!tenant) {
  throw new Error("[seed:admin] dev tenant not found — run `bun run db:seed` first");
}

const [existingUser] = await db
  .select({ id: user.id, email: user.email })
  .from(user)
  .where(eq(user.email, email));

let userId: string;
if (existingUser) {
  userId = existingUser.id;
  console.log(`[seed:admin] user ${email} already exists — ensuring owner membership`);
} else {
  const created = await getAuth().api.signUpEmail({
    body: { email, password, name: "Dev Founder" },
  });
  userId = created.user.id;
  console.log(`[seed:admin] created founder ${email}`);
}

await db
  .insert(memberships)
  .values({ tenantId: tenant.id, userId, role: "owner" })
  .onConflictDoNothing({ target: [memberships.tenantId, memberships.userId] });

console.log(
  `[seed:admin] owner membership ensured on tenant '${tenant.name}' (${tenantSlug})`,
);
console.log(`[seed:admin] credentials → email: ${email} password: ${password} (dev default — change for any real env)`);
console.log(`[seed:admin] sign in at: http://localhost:3100/login`);

await shutdownDeps();
