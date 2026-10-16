#!/usr/bin/env bun
/**
 * smoke.ts — post-deploy verification. Hits liveness + readiness on every
 * target and prints a status table. Run: `bun scripts/smoke.ts [base-api-url]`
 *
 * Liveness  (/health): process alive          → must be 200
 * Readiness (/ready):  dependencies reachable → 200 expected, 503 = degraded
 */

const API = process.argv[2] ?? process.env.API_URL ?? "http://localhost:3001";
const WORKER = process.argv[3] ?? process.env.WORKER_URL ?? "http://localhost:3002";
const WEB = process.argv[4] ?? process.env.WEB_URL ?? "http://localhost:3100";

type Row = { target: string; path: string; status: number | string; ok: boolean; detail?: string };

async function check(target: string, path: string): Promise<Row> {
  try {
    const res = await fetch(`${target}${path}`, { signal: AbortSignal.timeout(5_000) });
    let detail = "";
    if (path === "/ready") {
      // readiness failures are diagnostic gold — show WHICH dependency failed
      const body = (await res.json().catch(() => null)) as {
        checks?: Record<string, boolean>;
      } | null;
      if (body?.checks) {
        detail = Object.entries(body.checks)
          .map(([k, v]) => `${k}=${v ? "up" : "DOWN"}`)
          .join(" ");
      }
    }
    return { target, path, status: res.status, ok: res.status === 200, detail };
  } catch {
    return { target, path, status: "ERR", ok: false, detail: "connection failed" };
  }
}

const rows = await Promise.all([
  check(API, "/health"),
  check(API, "/ready"),
  check(WORKER, "/health"),
  check(WEB, "/"),
]);

for (const r of rows) {
  console.log(
    `${r.ok ? "✅" : "❌"} ${r.target}${r.path} → ${r.status}${r.detail ? `  (${r.detail})` : ""}`,
  );
}

const failed = rows.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length}/${rows.length} checks failed`);
  process.exit(1);
}
console.log(`\nAll ${rows.length} checks passed`);
