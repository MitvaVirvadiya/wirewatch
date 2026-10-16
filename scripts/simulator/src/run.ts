/**
 * Simulator CLI — `bun run sim:run [-- --mode clean|late|duplicate|drift|stale|partial]`
 *
 * Looks up the seeded dev tenant + its 3 monitors via @wirewatch/db, then
 * delivers signed synthetic events to the ingestion endpoint. This IS the
 * MVP demo driver (docs/product/mvp-scope.md "Demo script").
 *
 * Host-run dev tool (not part of any deployed image); if simulator trigger
 * endpoints ever exist, they mount ONLY behind debugEndpointsAllowed().
 */
import { eq } from "drizzle-orm";
import { createDb, resolveDatabaseUrl } from "@wirewatch/db";
import { monitors, tenants } from "@wirewatch/db";
import { generateEvents, MONITOR_NAMES, type SimulatorMode } from "./providers";
import { signedIngestRequest } from "./sign";

const MODES: SimulatorMode[] = [
  "clean",
  "late",
  "duplicate",
  "drift",
  "stale",
  "partial",
];

function parseArgs(argv: string[]) {
  const args: { mode: SimulatorMode; api: string; tenantSlug: string } = {
    mode: "clean",
    api: "http://localhost:3001",
    tenantSlug: "dev-financial",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mode") {
      const value = argv[i + 1];
      if (!value || !MODES.includes(value as SimulatorMode)) {
        throw new Error(`--mode must be one of: ${MODES.join(" | ")}`);
      }
      args.mode = value as SimulatorMode;
      i++;
    } else if (arg === "--api") {
      const value = argv[i + 1];
      if (!value) throw new Error("--api requires a URL");
      args.api = value;
      i++;
    } else if (arg === "--tenant") {
      const value = argv[i + 1];
      if (!value) throw new Error("--tenant requires a slug");
      args.tenantSlug = value;
      i++;
    }
  }
  return args;
}

const { mode, api, tenantSlug } = parseArgs(process.argv.slice(2));
const secret = process.env.INGEST_HMAC_SECRET;
if (!secret) {
  console.warn(
    "[sim] INGEST_HMAC_SECRET not set — using local default 'dev-ingest-secret' " +
      "(must match the API's env; staging/prod must set a real secret)",
  );
}
const ingestSecret = secret ?? "dev-ingest-secret";

const { db, sql } = createDb(resolveDatabaseUrl());

const [tenant] = await db
  .select()
  .from(tenants)
  .where(eq(tenants.slug, tenantSlug));
if (!tenant) {
  throw new Error(
    `[sim] tenant '${tenantSlug}' not found — run \`bun run db:seed\` first`,
  );
}

const tenantMonitors = await db
  .select()
  .from(monitors)
  .where(eq(monitors.tenantId, tenant.id));

const monitorIdByKey = (key: keyof typeof MONITOR_NAMES): string => {
  const name = MONITOR_NAMES[key];
  const monitor = tenantMonitors.find((m) => m.name === name);
  if (!monitor) throw new Error(`[sim] monitor '${name}' not found — seed first`);
  return monitor.id;
};

const runId = `${mode}-${Date.now()}`;
const events = generateEvents(mode, new Date(), runId);

console.log(
  `[sim] mode=${mode} tenant=${tenantSlug} api=${api} events=${events.length}`,
);

let failures = 0;
for (const event of events) {
  const monitorId = monitorIdByKey(event.monitorKey);
  const request = signedIngestRequest({
    apiBaseUrl: api,
    monitorId,
    providerEventId: event.providerEventId,
    payload: event.payload,
    secret: ingestSecret,
  });
  let status: number;
  let body: Record<string, unknown>;
  try {
    const res = await fetch(request);
    status = res.status;
    body = (await res.json()) as Record<string, unknown>;
  } catch (error) {
    failures++;
    console.error(
      `[sim] ✗ ${event.monitorKey}/${event.providerEventId} — request failed: ${error}`,
    );
    continue;
  }
  const ok = status === 202;
  if (!ok) failures++;
  const summary = ok
    ? `duplicate=${String(body["duplicate"])}${
        body["incident"] ? ` incident=${JSON.stringify(body["incident"])}` : ""
      }`
    : JSON.stringify(body);
  console.log(
    `[sim] ${ok ? "✓" : "✗"} ${event.monitorKey}/${event.providerEventId} → ${status} ${summary}`,
  );
}

await sql.end();
if (failures > 0) {
  console.error(`[sim] ${failures} delivery failure(s)`);
  process.exit(1);
}
console.log(`[sim] mode=${mode} complete`);
