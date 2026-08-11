"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordField from "@/components/PasswordField";
import "@/app/invoice/invoice-page.css";
import "@/app/auth-pages.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password }),
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
    <div className="afs-auth-bg">
      <form onSubmit={onSubmit} className="afs-auth-card">
        <img src="/logo.jpeg" alt="" className="afs-auth-logo" />
        <div className="afs-auth-title">Aarush Fire Protection Systems</div>
        <div className="afs-auth-subtitle">Sign in to Billing &amp; Invoicing</div>

        {error && <div className="afs-auth-message error">{error}</div>}

        <div className="afs-auth-field">
          <label>Email</label>
          <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <PasswordField label="Password" required value={password} onChange={setPassword} />

        <button type="submit" disabled={loading} className="afs-btn afs-btn-primary afs-auth-submit">
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="afs-auth-links">
          <span />
          <a href="/forgot-password">Forgot password?</a>
        </div>
      </form>
    </div>
  );
}
