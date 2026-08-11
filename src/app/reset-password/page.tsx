"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import PasswordField from "@/components/PasswordField";
import "@/app/invoice/invoice-page.css";
import "@/app/auth-pages.css";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reset password");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <div className="afs-auth-message error">This link is missing a token. Request a new one from the forgot-password page.</div>;
  }

  if (done) {
    return (
      <>
        <div className="afs-auth-message success">Password set. You can sign in now.</div>
        <a href="/login" className="afs-btn afs-btn-primary afs-auth-submit" style={{ textAlign: "center" }}>
          Go to sign in
        </a>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="afs-auth-message error">{error}</div>}
      <PasswordField label="New password" required minLength={8} autoFocus value={password} onChange={setPassword} />
      <PasswordField label="Confirm password" required minLength={8} value={confirm} onChange={setConfirm} />
      <button type="submit" disabled={loading} className="afs-btn afs-btn-primary afs-auth-submit">
        {loading ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="afs-auth-bg">
      <div className="afs-auth-card">
        <img src="/logo.jpeg" alt="" className="afs-auth-logo" />
        <div className="afs-auth-title">Set a new password</div>
        <div className="afs-auth-subtitle">Choose a password with at least 8 characters</div>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
