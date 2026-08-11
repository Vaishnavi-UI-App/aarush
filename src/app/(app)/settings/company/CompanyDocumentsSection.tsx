"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, TrashIcon } from "@/components/icons";

interface Document {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy: { name: string | null; email: string } | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CompanyDocumentsSection({ initialDocuments }: { initialDocuments: Document[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file first");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("title", title.trim());
      body.append("file", file);
      const res = await fetch("/api/company-documents", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload document");
      setDocuments((docs) => [data, ...docs]);
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string, docTitle: string) {
    if (!window.confirm(`Delete "${docTitle}"? This can't be undone.`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/company-documents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete document");
      setDocuments((docs) => docs.filter((d) => d.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete document");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <form onSubmit={upload} className="afs-form-row" style={{ alignItems: "flex-end" }}>
        <div className="afs-form-field">
          <label>Document title *</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fire Safety Policy 2026" />
        </div>
        <div className="afs-form-field">
          <label>File *</label>
          <input
            ref={fileInputRef}
            required
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            title="Any file type -- PDF, Excel, image, CSV, etc. Max 25MB."
          />
        </div>
        <div className="afs-form-field" style={{ flex: "0 0 auto" }}>
          <button type="submit" disabled={uploading} className="afs-btn afs-btn-primary">
            {uploading ? "Uploading…" : "+ Upload Document"}
          </button>
        </div>
      </form>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 4, marginBottom: 10 }}>{error}</div>}

      {documents.length === 0 ? (
        <div className="afs-empty" style={{ marginTop: 16 }}>
          No documents uploaded yet.
        </div>
      ) : (
        <table className="afs-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Title</th>
              <th>File</th>
              <th>Size</th>
              <th>Uploaded by</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td data-label="Title">{d.title}</td>
                <td data-label="File">{d.fileName}</td>
                <td data-label="Size">{formatSize(d.fileSize)}</td>
                <td data-label="Uploaded by">{d.uploadedBy?.name || d.uploadedBy?.email || "—"}</td>
                <td data-label="Date">{new Date(d.createdAt).toLocaleDateString("en-IN")}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <a href={`/api/company-documents/${d.id}/download`} className="afs-icon-btn download" title="Download">
                      <DownloadIcon />
                    </a>
                    <button
                      type="button"
                      onClick={() => remove(d.id, d.title)}
                      disabled={busyId === d.id}
                      title="Delete"
                      className="afs-icon-btn danger"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
