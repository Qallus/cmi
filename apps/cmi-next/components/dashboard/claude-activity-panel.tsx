"use client";

// Settings → Claude → Clients & Activity. Which AI apps may connect to CMI
// and at which risk tiers, what AI did recently, the trash (with Restore),
// and the daily caps. Super Admin / Admin view and restore; Super Admin edits.
import * as React from "react";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Client = { id: string; kind: string; name: string; redirect_uris: string[]; allowed_tiers: string[]; enabled: boolean };
type Call = {
  id: string; created_at: string; staff_name: string; client_kind: string | null; tool: string; risk: string | null;
  entity: string | null; record_id: string | null; success: boolean; error: string | null; confirmation_id: string | null;
};
type Trash = { id: string; entity: string; record_id: string; label: string | null; deleted_at: string; deleted_via: string; deleted_by_name: string };
type Payload = {
  canEdit: boolean; clients: Client[]; calls: Call[]; trash: Trash[];
  caps: Record<string, number>; people: { id: string; name: string }[]; error?: string;
};

const TIERS = ["read", "write", "high"] as const;
const TIER_HELP: Record<string, string> = {
  read: "Look things up",
  write: "Create and edit records (logged with before/after)",
  high: "Send, delete, publish (always previewed, then confirmed)",
};
const KIND_LABEL: Record<string, string> = { claude: "Claude", chatgpt: "ChatGPT", codex: "Codex", paperclip: "Paperclip", other: "Other" };
const RISK_TONE: Record<string, "default" | "warning" | "danger"> = { read: "default", write: "warning", high: "danger" };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ClaudeActivityPanel() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [risk, setRisk] = React.useState("");
  const [person, setPerson] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (risk) params.set("risk", risk);
    if (person) params.set("staff", person);
    const res = await fetch(`/api/admin/ai-access/activity?${params}`);
    const json = (await res.json().catch(() => ({}))) as Payload;
    if (!res.ok || json.error) { setError(json.error ?? `HTTP ${res.status}`); return; }
    setError(null);
    setData(json);
  }, [risk, person]);
  React.useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key);
    const res = await fetch("/api/admin/ai-access/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(json.error ?? "Couldn't save."); return false; }
    await load();
    return true;
  }

  if (error && !data) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;

  return (
    <div className="space-y-8">
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <section>
        <h3 className="text-sm font-semibold">Connected apps</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Which AI apps may connect to CMI, and what they may do. People still need &quot;Connect Claude&quot; above, and their role still applies.
        </p>
        <div className="mt-3 space-y-2">
          {data.clients.map((c) => <ClientRow key={c.id} client={c} canEdit={data.canEdit} busy={busy === c.id} onSave={(b) => post({ action: "client", id: c.id, ...b }, c.id)} />)}
          {data.canEdit && <NewClient busy={busy === "new"} onSave={(b) => post({ action: "client", ...b }, "new")} />}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Daily limits per person</h3>
        <p className="mt-1 text-xs text-muted-foreground">How many of each high-risk action one person can do through AI per day (resets at midnight Arizona time).</p>
        <Caps caps={data.caps} canEdit={data.canEdit} busy={busy === "caps"} onSave={(caps) => post({ action: "caps", caps }, "caps")} />
      </section>

      <section>
        <h3 className="text-sm font-semibold">Trash</h3>
        <p className="mt-1 text-xs text-muted-foreground">Everything AI deleted. Nothing is gone: Restore puts it back exactly as it was.</p>
        {data.trash.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">The trash is empty.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {data.trash.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.label ?? t.record_id}</p>
                  <p className="text-xs text-muted-foreground">{t.entity.replace(/_/g, " ")} · {t.deleted_by_name} via {t.deleted_via === "mcp" ? "Claude/AI app" : t.deleted_via} · {when(t.deleted_at)}</p>
                </div>
                <Button size="sm" variant="outline" disabled={busy === t.id} onClick={() => void post({ action: "restore", trash_id: t.id }, t.id)}>
                  {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Activity</h3>
            <p className="mt-1 text-xs text-muted-foreground">The last 100 things AI apps did in CMI.</p>
          </div>
          <div className="flex gap-2">
            <Select value={person} onChange={(e) => setPerson(e.target.value)} className="w-44 [&>button]:h-8">
              <option value="">Everyone</option>
              {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select value={risk} onChange={(e) => setRisk(e.target.value)} className="w-32 [&>button]:h-8">
              <option value="">Any risk</option>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </div>
        <div className="cmi-table-scroll mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-max whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-3 py-2">When</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">App</th>
                <th className="px-3 py-2">Tool</th><th className="px-3 py-2">Risk</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.calls.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">No activity yet.</td></tr>}
              {data.calls.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-muted-foreground">{when(c.created_at)}</td>
                  <td className="px-3 py-2">{c.staff_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{KIND_LABEL[c.client_kind ?? ""] ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.tool}</td>
                  <td className="px-3 py-2"><Badge tone={RISK_TONE[c.risk ?? "read"] ?? "default"}>{c.risk ?? "read"}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{c.entity ? `${c.entity.replace(/_/g, " ")}${c.record_id ? ` · ${c.record_id.slice(0, 8)}` : ""}` : "—"}</td>
                  <td className={cn("px-3 py-2", c.success ? "text-muted-foreground" : "text-destructive")}>
                    <span className="block max-w-[18rem] truncate" title={c.error ?? undefined}>
                      {c.success ? (c.confirmation_id && !c.tool.includes(":") ? "Previewed, waiting for confirm" : "OK") : c.error ?? "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TierChecks({ tiers, disabled, onChange }: { tiers: string[]; disabled: boolean; onChange: (t: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {TIERS.map((t) => (
        <label key={t} title={TIER_HELP[t]} className={cn("flex items-center gap-1.5 text-xs", disabled && "opacity-60")}>
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" disabled={disabled || t === "read"} checked={tiers.includes(t)}
            onChange={(e) => onChange(e.target.checked ? [...new Set([...tiers, t])] : tiers.filter((x) => x !== t))} />
          {t}
        </label>
      ))}
    </div>
  );
}

function ClientRow({ client, canEdit, busy, onSave }: { client: Client; canEdit: boolean; busy: boolean; onSave: (b: Partial<Client>) => Promise<boolean> }) {
  const [tiers, setTiers] = React.useState(client.allowed_tiers);
  const [uris, setUris] = React.useState(client.redirect_uris.join("\n"));
  const dirty = tiers.join() !== client.allowed_tiers.join() || uris.trim() !== client.redirect_uris.join("\n");
  const save = (patch: Partial<Client> = {}) => onSave({
    kind: client.kind, name: client.name, enabled: client.enabled, allowed_tiers: tiers,
    redirect_uris: uris.split(/[\s,]+/).filter(Boolean), ...patch,
  });
  return (
    <div className={cn("rounded-lg border border-border p-3", !client.enabled && "opacity-70")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{client.name}</span>
          <Badge>{KIND_LABEL[client.kind] ?? client.kind}</Badge>
          {!client.enabled && <Badge tone="danger">Off</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <TierChecks tiers={tiers} disabled={!canEdit} onChange={setTiers} />
          {canEdit && (
            <>
              {dirty && <Button size="sm" variant="accent" disabled={busy} onClick={() => void save()}>Save</Button>}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void save({ enabled: !client.enabled })}>{client.enabled ? "Switch off" : "Switch on"}</Button>
            </>
          )}
        </div>
      </div>
      {canEdit ? (
        <textarea value={uris} onChange={(e) => setUris(e.target.value)} rows={Math.max(1, client.redirect_uris.length)}
          className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px]" aria-label="Redirect URIs (one per line)" />
      ) : (
        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{client.redirect_uris.join(" · ") || "No redirect URIs"}</p>
      )}
    </div>
  );
}

function NewClient({ busy, onSave }: { busy: boolean; onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState("chatgpt");
  const [name, setName] = React.useState("ChatGPT (Business)");
  const [uris, setUris] = React.useState("");
  const [tiers, setTiers] = React.useState<string[]>(["read", "write", "high"]);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add an app</Button>;
  return (
    <div className="space-y-2 rounded-lg border border-accent/40 p-3">
      <div className="flex flex-wrap gap-2">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-36 [&>button]:h-8">
          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-8 w-56" />
        <TierChecks tiers={tiers} disabled={false} onChange={setTiers} />
      </div>
      <textarea value={uris} onChange={(e) => setUris(e.target.value)} rows={2} placeholder="OAuth redirect URI(s), one per line (from the app's connector setup)"
        className="w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px]" />
      <div className="flex gap-2">
        <Button size="sm" variant="accent" disabled={busy || !name.trim()} onClick={async () => {
          if (await onSave({ kind, name, redirect_uris: uris.split(/[\s,]+/).filter(Boolean), allowed_tiers: tiers, enabled: true })) setOpen(false);
        }}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function Caps({ caps, canEdit, busy, onSave }: { caps: Record<string, number>; canEdit: boolean; busy: boolean; onSave: (c: Record<string, number>) => Promise<boolean> }) {
  const [draft, setDraft] = React.useState(caps);
  const dirty = Object.keys(caps).some((k) => caps[k] !== draft[k]);
  const LABEL: Record<string, string> = { email: "Emails", sms: "Text messages", trash: "Deletes (to trash)" };
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      {Object.keys(caps).map((k) => (
        <label key={k} className="text-xs">
          <span className="mb-1 block text-muted-foreground">{LABEL[k] ?? k}</span>
          <Input type="number" min={0} max={1000} disabled={!canEdit} value={draft[k] ?? 0}
            onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} className="h-8 w-28" />
        </label>
      ))}
      {canEdit && dirty && <Button size="sm" variant="accent" disabled={busy} onClick={() => void onSave(draft)}>Save limits</Button>}
    </div>
  );
}
