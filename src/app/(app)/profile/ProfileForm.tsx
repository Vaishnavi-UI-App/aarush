"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizePhotoToDataUrl } from "@/lib/capture";
import { CameraIcon } from "@/components/icons";

export default function ProfileForm({
  initialName,
  email,
  initialPhone,
  initialPhoto,
  roleName,
}: {
  initialName: string;
  email: string;
  initialPhone: string;
  initialPhoto: string | null;
  roleName: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = (name || email)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizePhotoToDataUrl(file);
      setPhoto(dataUrl);
    } catch {
      setError("Could not read that photo -- try a different image.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || undefined, photoData: photo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="profile-form">
      <div className="profile-avatar-row">
        <div className="profile-avatar-wrap">
          {photo ? (
            <img src={photo} alt="" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-fallback">{initials}</div>
          )}
          <button type="button" className="profile-avatar-edit" title="Change photo" onClick={() => fileInputRef.current?.click()}>
            <CameraIcon />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhotoSelected} />
        </div>
        <div>
          <div className="profile-name-preview">{name || "Your name"}</div>
          <div className="profile-role-badge">{roleName}</div>
        </div>
      </div>

      <div className="afs-form-row" style={{ marginTop: 24 }}>
        <div className="afs-form-field">
          <label>Name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 98765 43210" />
        </div>
      </div>

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Email</label>
          <input readOnly value={email} title="Email is your login and can't be changed here" />
        </div>
        <div className="afs-form-field">
          <label>Role</label>
          <input readOnly value={roleName} />
        </div>
      </div>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {saved && !error && <div style={{ color: "#14532d", fontSize: 13, marginBottom: 10 }}>Saved.</div>}

      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Saving…" : "Save Profile"}
      </button>
    </form>
  );
}
