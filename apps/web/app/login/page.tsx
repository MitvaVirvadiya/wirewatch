"use client";

/**
 * Login page (Phase 2c) — invite-only: if you don't have an account, a
 * tenant owner/admin must invite you (POST /api/invites, console-email in
 * dev). Bootstrap dev founder with `bun run --filter @wirewatch/api seed:admin`.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message ?? "Sign-in failed");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main style={{ maxWidth: 420, margin: "6rem auto", padding: "0 1rem" }}>
      <h1>🛰️ Wirewatch</h1>
      <p>Finance-aware reliability monitoring — sign in</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={inputStyle}
        />
        <button type="submit" disabled={busy} style={buttonStyle}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error ? (
          <p role="alert" style={{ color: "#b00020" }}>
            {error}
          </p>
        ) : null}
      </form>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        No account? Wirewatch is invite-only — ask a tenant admin. (Dev
        bootstrap: <code>bun run --filter @wirewatch/api seed:admin</code>)
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: "1rem",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  borderRadius: 6,
  border: "none",
  background: "#111",
  color: "#fff",
  fontSize: "1rem",
  cursor: "pointer",
};
