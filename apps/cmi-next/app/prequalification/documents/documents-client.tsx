"use client";

import * as React from "react";
import { Check, CloudUpload, Loader2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

type Doc = { id: string; label: string; status: string; expires_on: string | null; file_name: string | null; rejection_reason: string | null; needed: boolean };

const STATUS: Record<string, string> = {
  requested: "Needed", uploaded: "Received, in review", in_review: "In review", verified: "On file",
  rejected: "Needs a new copy", expired: "Expired",
};

export function DocumentsClient() {
  const [token, setToken] = React.useState<string | null>(null);
  const [data, setData] = React.useState<{ company: string | null; documents: Doc[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (t: string) => {
    const res = await fetch(`/api/prequal/${t}/documents`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "That link isn't working."); return; }
    setData(json);
  }, []);

  React.useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    if (!t) { setError("This page needs the link from our email."); return; }
    // eslint-disable-next-line -- one-time read of the link's token on mount
    setToken(t);
    void load(t);
  }, [load]);

  if (error) return <p className="rounded-xl border border-border bg-card p-6 text-sm">{error} Email <span className="font-medium">info@constructedmatter.com</span> if you need a new one.</p>;
  if (!data || !token) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your documents…</p>;

  const needed = data.documents.filter((d) => d.needed);
  return (
    <div className="space-y-6">
      {data.company && <p className="text-sm text-muted-foreground">Documents for <span className="font-medium text-foreground">{data.company}</span></p>}
      {needed.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm"><Check className="h-4 w-4 text-accent" /> Nothing outstanding right now. Thank you.</p>
      )}
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {data.documents.map((d) => <DocRow key={d.id} doc={d} token={token} onDone={() => void load(token)} />)}
      </ul>
      <p className="text-xs text-muted-foreground">PDF, JPG or PNG, up to 15 MB. Questions? Call (480) 628-4458 or email info@constructedmatter.com.</p>
    </div>
  );
}

function DocRow({ doc, token, onDone }: { doc: Doc; token: string; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const expired = !!doc.expires_on && doc.expires_on < today;

  async function upload(file: File) {
    setBusy(true); setError(null);
    const body = new FormData();
    body.set("file", file); body.set("document_id", doc.id);
    const res = await fetch(`/api/prequal/${token}/documents`, { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Upload failed."); return; }
    onDone();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-medium">{doc.label}</p>
        <p className={cn("text-xs", doc.needed ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
          {expired ? "Expired" : STATUS[doc.status] ?? doc.status}
          {doc.expires_on ? ` · expires ${new Date(doc.expires_on + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "medium" })}` : ""}
        </p>
        {doc.rejection_reason && doc.status === "rejected" && <p className="text-xs text-destructive">{doc.rejection_reason}</p>}
        {doc.file_name && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="h-3 w-3" /> {doc.file_name}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition",
        doc.needed ? "border-accent bg-accent text-white hover:bg-accent/90" : "border-border hover:bg-muted", busy && "pointer-events-none opacity-60")}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
        {busy ? "Uploading…" : doc.file_name ? "Upload a new copy" : "Upload"}
        <input type="file" className="sr-only" accept=".pdf,image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
      </label>
    </li>
  );
}
