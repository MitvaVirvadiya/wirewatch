"use client";

/**
 * Dashboard (Phase 2c minimal) — the authenticated demo surface: monitors
 * and recent incidents of every tenant the user belongs to, membership-
 * scoped server-side (cross-tenant isolation is enforced by the API).
 * Phase 6 replaces this with the realtime investigation UI.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiBaseUrl, authClient } from "../../lib/auth-client";

interface Membership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}
interface Monitor {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  status: string;
  schedule: string | null;
  graceSec: number;
}
interface Incident {
  id: string;
  tenantId: string;
  failureType: string;
  status: string;
  occurrenceCount: number;
  lastSeen: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch(`${apiBaseUrl}/api/me`, {
          credentials: "include",
        });
        if (meRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (!meRes.ok) throw new Error(`/api/me → ${meRes.status}`);
        const meBody = (await meRes.json()) as {
          user: { email: string };
          memberships: Membership[];
        };
        if (cancelled) return;
        setEmail(meBody.user.email);
        setMemberships(meBody.memberships);

        const [monRes, incRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/monitors`, { credentials: "include" }),
          fetch(`${apiBaseUrl}/api/incidents`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (monRes.ok) {
          setMonitors(
            ((await monRes.json()) as { monitors: Monitor[] }).monitors,
          );
        }
        if (incRes.ok) {
          setIncidents(
            ((await incRes.json()) as { incidents: Incident[] }).incidents,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "load failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const tenantName = (tenantId: string) =>
    memberships.find((m) => m.tenantId === tenantId)?.tenantName ?? tenantId.slice(0, 8);

  return (
    <main style={{ maxWidth: 900, margin: "3rem auto", padding: "0 1rem" }}>
      <h1>🛰️ Wirewatch dashboard</h1>
      <p>
        {email ? (
          <>
            Signed in as <strong>{email}</strong> —{" "}
            {memberships
              .map((m) => `${m.tenantName} (${m.role})`)
              .join(", ") || "no tenants"}
          </>
        ) : (
          "loading…"
        )}
      </p>
      <button
        onClick={async () => {
          await authClient.signOut();
          router.replace("/login");
        }}
        style={{ marginBottom: "1.5rem" }}
      >
        Sign out
      </button>
      {error ? <p role="alert" style={{ color: "#b00020" }}>{error}</p> : null}

      <h2>Monitors ({monitors.length})</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th>Tenant</th><th>Name</th><th>Type</th><th>Status</th>
            <th>Schedule</th><th>Grace</th>
          </tr>
        </thead>
        <tbody>
          {monitors.map((m) => (
            <tr key={m.id}>
              <td>{tenantName(m.tenantId)}</td>
              <td>{m.name}</td>
              <td>{m.type}</td>
              <td>{m.status}</td>
              <td>{m.schedule ?? "—"}</td>
              <td>{m.graceSec}s</td>
            </tr>
          ))}
          {monitors.length === 0 ? (
            <tr><td colSpan={6}>No monitors yet — run `bun run db:seed`</td></tr>
          ) : null}
        </tbody>
      </table>

      <h2>Recent incidents ({incidents.length})</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th>Tenant</th><th>Failure</th><th>Status</th>
            <th>Occurrences</th><th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id}>
              <td>{tenantName(i.tenantId)}</td>
              <td>{i.failureType}</td>
              <td>{i.status}</td>
              <td>{i.occurrenceCount}</td>
              <td>{new Date(i.lastSeen).toLocaleString()}</td>
            </tr>
          ))}
          {incidents.length === 0 ? (
            <tr><td colSpan={5}>No incidents — run the simulator: `bun run sim:run -- --mode late`</td></tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: "2rem",
  fontSize: "0.95rem",
};
