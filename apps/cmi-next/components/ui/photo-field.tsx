"use client";

import * as React from "react";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

// Reusable photo field: shows the current image, uploads a new one to
// Supabase Storage (via /api/admin/uploads), accepts a pasted URL, and removes.
export function PhotoField({
  label, value, onChange, folder = "team", hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  hint?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function upload(file: File) {
    setBusy(true); setErr("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || "Upload failed.");
      onChange(json.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-start gap-3">
        {value
          ? <img src={value} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover object-top" />
          : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
              <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : value ? "Replace" : "Upload"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            </label>
            {value && (
              <button type="button" onClick={() => onChange("")} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-muted">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          <Input placeholder="…or paste an image URL" value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      </div>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
