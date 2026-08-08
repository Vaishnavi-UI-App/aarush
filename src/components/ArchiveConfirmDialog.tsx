"use client";

import { useState } from "react";

export default function ArchiveConfirmDialog({
  title,
  itemLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  itemLabel: string;
  busy: boolean;
  error?: string | null;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="afs-modal-backdrop" onClick={onCancel}>
      <div className="afs-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>
          Move {itemLabel} to Archive? You can restore it later from the Archive page.
        </p>

        <div className="afs-form-field" style={{ marginBottom: 16 }}>
          <label>Reason (optional)</label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why is this being deleted? e.g. duplicate entry, customer cancelled…"
            autoFocus
          />
        </div>

        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} disabled={busy} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(note.trim())} disabled={busy} className="afs-btn afs-btn-primary">
            {busy ? "Archiving…" : "Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}
