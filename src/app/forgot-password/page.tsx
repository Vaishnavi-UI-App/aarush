"use client";

import { useState } from "react";
import "@/app/invoice/invoice-page.css";
import "@/app/auth-pages.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="afs-auth-bg">
      <form onSubmit={onSubmit} className="afs-auth-card">
        <img src="/logo.jpeg" alt="" className="afs-auth-logo" />
        <div className="afs-auth-title">Forgot password</div>
        <div className="afs-auth-subtitle">We&apos;ll email you a link to set a new one</div>

        {sent ? (
          <div className="afs-auth-message success">
            If that email is registered, a reset link is on its way. Check your inbox (and spam folder).
          </div>
        ) : (
          <>
            <div className="afs-auth-field">
              <label>Email</label>
              <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="afs-btn afs-btn-primary afs-auth-submit">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}

        <div className="afs-auth-links">
          <a href="/login">Back to sign in</a>
          <span />
        </div>
      </form>
    </div>
  );
}
