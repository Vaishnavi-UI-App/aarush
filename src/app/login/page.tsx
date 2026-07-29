"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/invoice/invoice-page.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@aarushfires.example");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="afs-page-bg" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form
        onSubmit={onSubmit}
        style={{
          background: "#fff",
          padding: 32,
          borderRadius: 10,
          boxShadow: "0 8px 30px rgba(13,31,61,0.15)",
          width: 340,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 18, color: "var(--afs-navy)", marginBottom: 4 }}>Aarush Fire Protection Systems</h1>
        <p style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>Billing &amp; Invoicing</p>

        <div
          style={{
            background: "#fff7e0",
            border: "1px solid #e6c65c",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 11,
            color: "#5c4a00",
            marginBottom: 16,
          }}
        >
          Development sign-in: enter a seeded user&apos;s email, no password required yet. Real
          authentication has not been built.
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", marginTop: 4, marginBottom: 16, borderRadius: 6, border: "1px solid #ccc" }}
        />

        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={loading} className="afs-btn afs-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
