"use client";

import * as React from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobFile } from "@/lib/job-files/types";
import { JobModuleShell, fmtDate } from "../job-module-shell";

function humanSize(n: number | null): string {
  if (!n) return "";
  const kb = n / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export function FilesClient({ jobId, jobName, initial }: { jobId: string; jobName: string; initial: JobFile[] }) {
  const [rows, setRows] = React.useState<JobFile[]>(initial);
  const [folder, setFolder] = React.useState("General");
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true); setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", folder);
        const res = await fetch(`/api/jobs/${jobId}/files`, { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Upload failed.");
        setRows((r) => [j, ...r]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  async function remove(id: string) {
    if (!confirm("Delete this file?")) return;
    const res = await fetch(`/api/jobs/${jobId}/files/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setRows((r) => r.filter((x) => x.id !== id));
  }

  const folders = Array.from(new Set(["General", ...rows.map((r) => r.folder ?? "General")]));

  return (
    <JobModuleShell jobId={jobId} jobName={jobName} active="files" title="Files"
      action={
        <div className="flex items-center gap-2">
          <select value={folder} onChange={(e) => setFolder(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value="Contracts">Contracts</option><option value="Drawings">Drawings</option><option value="Permits">Permits</option><option value="Photos">Photos</option>
          </select>
          <Button size="sm" variant="accent" onClick={() => inputRef.current?.click()} disabled={uploading}><Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}</Button>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
        </div>
      }>
      {error && <div className="mb-3 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}
        className="mb-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground"
      >
        Drag &amp; drop files here, or use Upload. Images, videos, PDFs, and docs up to 50 MB → stored in the job&apos;s media folder.
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No files uploaded yet.</div>
      ) : (
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-card"><tr className="border-b border-border text-left">
            {["Name", "Folder", "Size", "Uploaded", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((f) => (
              <tr key={f.id} className="hover:bg-muted/30">
                <td className="px-4 py-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{f.name}</span></div></td>
                <td className="px-4 py-3 text-muted-foreground">{f.folder}</td>
                <td className="px-4 py-3 text-muted-foreground">{humanSize(f.size_bytes)}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(f.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <a href={f.file_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><Download className="h-4 w-4" /></a>
                    <button type="button" onClick={() => void remove(f.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </JobModuleShell>
  );
}
