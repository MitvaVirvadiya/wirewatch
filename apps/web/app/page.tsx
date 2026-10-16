/**
 * Phase 1 shell page: proves web → api connectivity by rendering the API's
 * /health response server-side. Replaced by the real dashboard in Phase 2.
 */

type Health = {
  ok: boolean;
  service: string;
  env: string;
  uptimeSec: number;
  time: string;
};

async function getApiHealth(): Promise<Health | { error: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
      cache: "no-store",
    });
    if (!res.ok) return { error: `API responded ${res.status}` };
    return (await res.json()) as Health;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "unreachable" };
  }
}

export default async function Home() {
  const health = await getApiHealth();

  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>🛰️ Wirewatch</h1>
      <p>
        Finance-aware reliability monitoring for provider integrations.{" "}
        <strong>Phase 1 skeleton</strong> — R&amp;D lab, synthetic data only.
      </p>

      <h2>API connectivity</h2>
      {"error" in health ? (
        <pre style={{ background: "#fee", padding: "1rem" }}>
          API unreachable: {health.error}
          {"\n"}Expected at {process.env.NEXT_PUBLIC_API_URL}/health
        </pre>
      ) : (
        <pre style={{ background: "#efe", padding: "1rem" }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      )}

      <p style={{ color: "#666" }}>
        Next: Phase 2 — auth (invite-only), tenants, first monitor type, synthetic
        provider simulator.
      </p>
    </main>
  );
}
