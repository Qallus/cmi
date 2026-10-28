"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, ExternalLink, Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { CommitmentRow } from "@/lib/commitments/data";

type Scope = "mine" | "waiting_on_me" | "all";
type Person = { id: string; name: string };

const WAITING_LABEL: Record<string, string> = { none: "", client: "Waiting on client", sub: "Waiting on sub", teammate: "Waiting on teammate", vendor: "Waiting on vendor" };
const SOURCE_LABEL: Record<string, string> = { email: "Email", sms: "Text", meeting: "Meeting", slack: "Slack", call: "Call", manual: "Added by hand" };
const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null);

export function CommitmentsClient({ initial, meId, canSeeAll, people }: { initial: CommitmentRow[]; meId: string; canSeeAll: boolean; people: Person[] }) {
  const [rows, setRows] = React.useState(initial);
  const [scope, setScope] = React.useState<Scope>("mine");
  const [status, setStatus] = React.useState("open");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const first = React.useRef(true);

  const load = React.useCallback(async () => {
    setBusy(true);
    const res = await fetch(`/api/commitments?scope=${scope}&status=${status}`);
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Couldn't load."); return; }
    setRows(json.commitments ?? []);
  }, [scope, status]);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    void load();
  }, [load]);

  async function act(id: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/commitments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Couldn't save."); return false; }
    await load();
    return true;
  }

  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent">Follow-through</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Commitments</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Promises and follow-ups from emails, meetings and calls, kept until they&apos;re done. Claude adds them when you approve; close them here with a note showing it happened.
          </p>
        </div>
        <Button size="sm" variant="accent" onClick={() => setAdding((v) => !v)}><Plus className="h-3.5 w-3.5" /> New commitment</Button>
      </header>

      {adding && <NewCommitment people={people} meId={meId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} />}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
          {([["mine", "Mine"], ["waiting_on_me", "Waiting on me"], ...(canSeeAll ? [["all", "Everyone"]] : [])] as [Scope, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setScope(k)}
              className={cn("rounded px-3 py-1", scope === k ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36 [&>button]:h-8">
          <option value="open">Open</option><option value="done">Done</option><option value="dismissed">Dismissed</option><option value="all">All</option>
        </Select>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} {status === "open" ? "open" : ""} {overdue > 0 && <span className="text-destructive">· {overdue} overdue</span>}
        </span>
      </div>

      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          Nothing here. Ask Claude &quot;what did I promise in today&apos;s meetings?&quot; to capture commitments, or add one by hand.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => <Row key={r.id} row={r} people={people} onAct={act} />)}
        </ul>
      )}
    </div>
  );
}

function Row({ row: r, people, onAct }: { row: CommitmentRow; people: Person[]; onAct: (id: string, body: Record<string, unknown>) => Promise<boolean> }) {
  const [mode, setMode] = React.useState<null | "done" | "dismiss" | "reassign">(null);
  const [text, setText] = React.useState("");
  const [owner, setOwner] = React.useState(r.owner_staff_id ?? "");
  const [saving, setSaving] = React.useState(false);
  const run = async (body: Record<string, unknown>) => { setSaving(true); const ok = await onAct(r.id, body); setSaving(false); if (ok) { setMode(null); setText(""); } };

  return (
    <li className={cn("rounded-lg border bg-card p-3", r.overdue ? "border-destructive/40" : "border-border", r.status !== "open" && "opacity-75")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("font-medium", r.status === "done" && "line-through decoration-muted-foreground")}>{r.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {r.owner_name && <span>{r.owner_name}</span>}
            {r.due_on && <span className={cn(r.overdue && "font-medium text-destructive")}>{r.overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}Due {fmt(r.due_on)}</span>}
            {WAITING_LABEL[r.waiting_on] && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">{WAITING_LABEL[r.waiting_on]}</span>}
            {r.job_label && <Link href={`/dashboard/jobs/${r.job_id}`} className="text-accent hover:underline">{r.job_label}</Link>}
            {r.deal_label && <Link href="/dashboard/pipeline" className="text-accent hover:underline">{r.deal_label}</Link>}
            {r.contact_name && <span>{r.contact_name}</span>}
            <span>{SOURCE_LABEL[r.source] ?? r.source}{r.created_via === "mcp" && <Sparkles className="ml-1 inline h-3 w-3 text-accent" aria-label="Captured by Claude" />}</span>
            {r.source_link && <a href={r.source_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">Source <ExternalLink className="h-3 w-3" /></a>}
          </p>
          {r.details && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.details}</p>}
          {r.resolved_evidence && r.status !== "open" && <p className="mt-1 text-xs text-muted-foreground">{r.status === "done" ? "Done" : "Dismissed"}: {r.resolved_evidence}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {r.status === "open" ? (
            <>
              <Button size="sm" variant="accent" onClick={() => setMode(mode === "done" ? null : "done")}><Check className="h-3.5 w-3.5" /> Done</Button>
              <Button size="sm" variant="outline" onClick={() => setMode(mode === "reassign" ? null : "reassign")}>Reassign</Button>
              <Button size="sm" variant="ghost" onClick={() => setMode(mode === "dismiss" ? null : "dismiss")} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void run({ action: "reopen" })}><RotateCcw className="h-3.5 w-3.5" /> Reopen</Button>
          )}
        </div>
      </div>
      {(mode === "done" || mode === "dismiss") && (
        <div className="mt-2 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} className="h-8 text-sm"
            placeholder={mode === "done" ? "How do we know it's done? (e.g. 'sent revised bid 11/3' or a link)" : "Why it no longer applies"} />
          <Button size="sm" variant="accent" disabled={saving || (mode === "done" && !text.trim())}
            onClick={() => void run(mode === "done" ? { action: "resolve", evidence: text } : { action: "dismiss", reason: text })}>Save</Button>
        </div>
      )}
      {mode === "reassign" && (
        <div className="mt-2 flex gap-2">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-56 [&>button]:h-8">
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Button size="sm" variant="accent" disabled={saving || !owner || owner === r.owner_staff_id}
            onClick={() => void run({ action: "update", changes: { owner_staff_id: owner } })}>Reassign</Button>
        </div>
      )}
    </li>
  );
}

function NewCommitment({ people, meId, onClose, onSaved }: { people: Person[]; meId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [due, setDue] = React.useState("");
  const [owner, setOwner] = React.useState(meId);
  const [waiting, setWaiting] = React.useState("none");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function save() {
    setSaving(true); setError(null);
    const res = await fetch("/api/commitments", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, details, due_on: due || null, owner_staff_id: owner, waiting_on: waiting, source: "manual" }) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Couldn't save."); return; }
    onSaved();
  }
  return (
    <div className="space-y-2 rounded-lg border border-accent/40 bg-card p-4">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What was promised? e.g. Send revised bid to the Smiths" />
      <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Details (optional)" />
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-muted-foreground">Due <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-40" /></label>
        <label className="text-xs text-muted-foreground">Owner
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-52 [&>button]:h-8">
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">Waiting on
          <Select value={waiting} onChange={(e) => setWaiting(e.target.value)} className="w-44 [&>button]:h-8">
            <option value="none">Nobody (it&apos;s ours)</option><option value="client">Client</option><option value="sub">Sub</option>
            <option value="teammate">Teammate</option><option value="vendor">Vendor</option>
          </Select>
        </label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="accent" disabled={saving || !title.trim()} onClick={() => void save()}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
