"use client";

// Trade Partners → Setup: the Master Subcontractor Agreement the application
// shows (upload a version, make it current, countersign signed agreements) and
// the trade → cost code map used on reports and exports.
import * as React from "react";
import { Check, ExternalLink, FileSignature, Loader2, Save, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmAction } from "@/components/ui/confirm-action";

type Version = { id: string; label: string; file_name: string | null; effective_at: string | null; is_current: boolean; created_at: string; url: string | null; sha256: string };
type Sig = {
  id: string; company_name: string | null; signer_name: string; signer_title: string | null; signer_email: string;
  signed_at: string; version_label: string | null; pdf_url: string | null; countersigner_name: string | null; countersigned_at: string | null;
};
type CostRow = { trade: string; cost_code: string | null; label: string | null; active: boolean };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" }) : "");

export function SetupPanel({ canDecide }: { canDecide: boolean }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <MsaCard canDecide={canDecide} />
      <CostCodesCard canDecide={canDecide} />
    </div>
  );
}

function MsaCard({ canDecide }: { canDecide: boolean }) {
  const [data, setData] = React.useState<{ versions: Version[]; signatures: Sig[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState("Rev 2026");
  const [effective, setEffective] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/trade-partners/msa");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Couldn't load."); return; }
    setData(json);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose the MSA PDF first."); return; }
    setBusy("upload"); setError(null);
    const body = new FormData();
    body.set("file", file); body.set("label", label); body.set("effective_at", effective); body.set("make_current", "true");
    const res = await fetch("/api/trade-partners/msa", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(json.error ?? "Upload failed."); return; }
    if (fileRef.current) fileRef.current.value = "";
    await load();
  }

  async function makeCurrent(v: Version) {
    if (!(await confirmAction({ title: `Make "${v.label}" the current MSA?`, body: "New applicants will be asked to sign this version." }))) return;
    setBusy(v.id);
    await fetch("/api/trade-partners/msa", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id }) });
    setBusy(null); await load();
  }

  async function countersign(s: Sig) {
    if (!(await confirmAction({ title: `Countersign for ${s.company_name ?? s.signer_name}?`, body: "Adds your countersignature to the agreement and emails the fully executed copy to the signer." }))) return;
    setBusy(s.id); setError(null);
    const res = await fetch("/api/trade-partners/msa/countersign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature_id: s.id }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(json.error ?? "Couldn't countersign.");
    await load();
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold"><FileSignature className="h-4 w-4 text-accent" /> Master Subcontractor Agreement</h2>
      <p className="mt-1 text-sm text-muted-foreground">Applicants read and sign the current version inside the application. Signed copies are filed on the partner&apos;s documents.</p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {!data ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <>
          {canDecide && (
            <div className="mt-4 grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_140px_150px_auto] sm:items-end">
              <label className="text-xs"><span className="mb-1 block text-muted-foreground">PDF</span>
                <input ref={fileRef} type="file" accept="application/pdf" className="block w-full text-sm" /></label>
              <label className="text-xs"><span className="mb-1 block text-muted-foreground">Version label</span>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
              <label className="text-xs"><span className="mb-1 block text-muted-foreground">Effective</span>
                <Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /></label>
              <Button size="sm" variant="accent" disabled={busy === "upload"} onClick={() => void upload()}>
                {busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload as current
              </Button>
            </div>
          )}

          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {data.versions.length === 0 && <li className="p-3 text-sm text-muted-foreground">No MSA uploaded yet. Until one is, applicants can submit without signing.</li>}
            {data.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{v.label}</span>{" "}
                  {v.is_current && <Badge tone="success">Current</Badge>}
                  <span className="block text-xs text-muted-foreground">{v.file_name} · uploaded {fmt(v.created_at)}{v.effective_at ? ` · effective ${fmt(v.effective_at)}` : ""}</span>
                </span>
                <span className="flex items-center gap-2">
                  {v.url && <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">View <ExternalLink className="h-3 w-3" /></a>}
                  {canDecide && !v.is_current && <Button size="sm" variant="outline" disabled={busy === v.id} onClick={() => void makeCurrent(v)}>Make current</Button>}
                </span>
              </li>
            ))}
          </ul>

          <h3 className="mt-6 text-sm font-semibold">Signed agreements</h3>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {data.signatures.length === 0 && <li className="p-3 text-sm text-muted-foreground">None yet.</li>}
            {data.signatures.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{s.company_name ?? "Not submitted yet"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.signer_name}{s.signer_title ? `, ${s.signer_title}` : ""} · {s.version_label} · signed {fmt(s.signed_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {s.countersigned_at
                    ? <Badge tone="success"><Check className="mr-1 h-3 w-3" />Executed {fmt(s.countersigned_at)}</Badge>
                    : canDecide && s.company_name
                      ? <Button size="sm" variant="accent" disabled={busy === s.id} onClick={() => void countersign(s)}>{busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />} Countersign</Button>
                      : <Badge tone="warning">Awaiting countersignature</Badge>}
                  {s.pdf_url && <a href={s.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">PDF <ExternalLink className="h-3 w-3" /></a>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CostCodesCard({ canDecide }: { canDecide: boolean }) {
  const [rows, setRows] = React.useState<CostRow[] | null>(null);
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [filter, setFilter] = React.useState("");

  React.useEffect(() => {
    void fetch("/api/trade-partners/cost-codes").then((r) => r.json()).then((j) => setRows(j.rows ?? []));
  }, []);

  async function save() {
    if (!rows) return;
    setState("saving");
    const res = await fetch("/api/trade-partners/cost-codes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    setState(res.ok ? "saved" : "error");
  }

  const shown = rows?.filter((r) => !filter || r.trade.toLowerCase().includes(filter.toLowerCase())) ?? [];
  const mapped = rows?.filter((r) => r.cost_code).length ?? 0;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold">Trade cost codes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Each trade on the application maps to a CMI cost code. Subs never see these; they appear on reports and exports.</p>
      {!rows ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2">
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter trades" className="flex-1" />
            <span className="text-xs text-muted-foreground">{mapped}/{rows.length} mapped</span>
          </div>
          <div className="mt-3 max-h-[520px] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Trade</th><th className="w-40 px-3 py-2 font-medium">Cost code</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((r) => (
                  <tr key={r.trade}>
                    <td className="px-3 py-1.5">{r.trade}</td>
                    <td className="px-3 py-1.5">
                      <Input value={r.cost_code ?? ""} disabled={!canDecide} placeholder="e.g. 06-100"
                        onChange={(e) => { setState("idle"); setRows((prev) => prev!.map((x) => (x.trade === r.trade ? { ...x, cost_code: e.target.value } : x))); }}
                        className="h-8" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canDecide && (
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" variant="accent" disabled={state === "saving"} onClick={() => void save()}>
                {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save cost codes
              </Button>
              {state === "saved" && <span className="text-xs text-success">Saved.</span>}
              {state === "error" && <span className="text-xs text-destructive">Couldn&apos;t save. Try again.</span>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
