"use client";

// Settings → Claude. Who may connect Claude to CMI, who has the company-wide
// (ownership) view, and who may receive AI-generated email/SMS/DMs/notifications.
// Capabilities come from lib/ai-access/capabilities.ts via the API; "planned"
// ones can be set now so the list is ready when the feature ships.
// Optimistic toggles with rollback; writes are Super-Admin-only server-side.
import * as React from "react";
import { Check, Copy, Loader2, Search, Sparkles, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { confirmAction } from "@/components/ui/confirm-action";

type Capability = { key: string; label: string; description: string; appliesTo: ("staff" | "contact")[]; status: "live" | "planned"; defaultRoles?: string[] };
type Person = {
  subject_type: "staff" | "contact"; id: string; name: string; email: string | null; phone: string | null;
  kind: string; company?: string | null;
  explicit: Record<string, boolean>; effective: Record<string, boolean>;
  claude_connected: boolean; claude_last_used: string | null;
};
type SearchResult = { subject_type: "staff" | "contact"; id: string; name: string; email: string | null; kind: string; company?: string | null };
type Payload = { capabilities: Capability[]; people: Person[]; canEdit: boolean; mcpUrl: string; connectedCount: number; error?: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin", project_manager: "Project Manager", staff: "Staff",
  designer: "Designer", estimator: "Estimator", superintendent: "Superintendent",
  subcontractor: "Subcontractor", vendor: "Vendor", client: "Client", viewer: "Viewer",
};
const kindLabel = (p: { subject_type: string; kind: string }) => (p.subject_type === "staff" ? ROLE_LABELS[p.kind] ?? p.kind : `Contact · ${p.kind}`);
const STAFF_ROLE_OPTIONS = ["super_admin", "admin", "project_manager", "staff", "designer", "estimator", "superintendent"];

function Toggle({ on, disabled, label, onClick }: { on: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-accent" : "bg-muted"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export function ClaudeAccessPanel() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [filterKind, setFilterKind] = React.useState("all");
  const [filterCap, setFilterCap] = React.useState("all");
  const [nameFilter, setNameFilter] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-access");
      const json = (await res.json()) as Payload;
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData((prev) => {
        // Keep people added this session who don't hold a grant yet.
        const added = prev?.people.filter((p) => !json.people.some((q) => q.id === p.id) && !Object.keys(p.explicit).length) ?? [];
        return { ...json, people: [...json.people, ...added] };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function send(method: "POST" | "DELETE", body: Record<string, unknown>) {
    const res = await fetch("/api/admin/ai-access", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  async function toggle(p: Person, cap: Capability) {
    const next = !p.effective[cap.key];
    const roleDefault = p.subject_type === "staff" && !!cap.defaultRoles?.includes(p.kind);
    // Matching the role default clears the override instead of pinning it.
    const enabled: boolean | null = next === roleDefault && cap.defaultRoles ? null : next;
    const cell = `${p.id}:${cap.key}`;
    setBusy(cell);
    setError(null);
    const patch = (on: boolean) => setData((d) => d && ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, effective: { ...x.effective, [cap.key]: on } } : x)) }));
    patch(next);
    try {
      await send("POST", { subject_type: p.subject_type, id: p.id, capability: cap.key, enabled });
      await load();
    } catch (e) {
      patch(!next);
      setError(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Person) {
    const ok = await confirmAction({
      title: `Remove ${p.name}?`,
      body: p.subject_type === "staff"
        ? "Clears every Claude setting for this person. Staff go back to their role's defaults."
        : "Clears every Claude setting for this contact and removes them from the list.",
      confirmLabel: "Remove", tone: "danger",
    });
    if (!ok) return;
    setBusy(p.id);
    try {
      await send("DELETE", { subject_type: p.subject_type, id: p.id });
      setData((d) => d && ({ ...d, people: d.people.filter((x) => x.subject_type === "staff" || x.id !== p.id) }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove.");
    } finally {
      setBusy(null);
    }
  }

  function addPerson(r: SearchResult) {
    setData((d) => {
      if (!d || d.people.some((p) => p.id === r.id)) return d;
      return { ...d, people: [...d.people, { ...r, phone: null, explicit: {}, effective: {}, claude_connected: false, claude_last_used: null }] };
    });
    setNameFilter(r.name);
  }

  if (error && !data) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading Claude access…</div>;
  }

  const caps = data.capabilities;
  const kinds = [...new Set(data.people.map((p) => (p.subject_type === "contact" ? "contact" : p.kind)))];
  const needle = nameFilter.trim().toLowerCase();
  const rows = data.people.filter((p) =>
    (filterKind === "all" || (filterKind === "contact" ? p.subject_type === "contact" : p.kind === filterKind && p.subject_type === "staff")) &&
    (filterCap === "all" || p.effective[filterCap]) &&
    (!needle || p.name.toLowerCase().includes(needle) || (p.email ?? "").toLowerCase().includes(needle)));

  return (
    <div className="space-y-5">
      <ConnectorCard url={data.mcpUrl} connected={data.connectedCount} copied={copied} onCopy={() => {
        void navigator.clipboard?.writeText(data.mcpUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }} />

      {!data.canEdit && <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Only Super Admins can change Claude access. You can view it here.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Filter people" className="pl-8" />
        </div>
        <Select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} aria-label="Filter by type" className="w-44">
          <option value="all">Everyone</option>
          {kinds.map((k) => <option key={k} value={k}>{k === "contact" ? "Contacts" : ROLE_LABELS[k] ?? k}</option>)}
        </Select>
        <Select value={filterCap} onChange={(e) => setFilterCap(e.target.value)} aria-label="Filter by capability" className="w-48">
          <option value="all">Any access</option>
          {caps.map((c) => <option key={c.key} value={c.key}>Has: {c.label}</option>)}
        </Select>
      </div>

      {data.canEdit && <AddPerson onAdd={addPerson} />}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Person</th>
              {caps.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center font-medium" title={c.description}>
                  <div className="leading-tight">{c.label}</div>
                  {c.status === "planned" && <div className="mt-0.5 text-[10px] font-normal uppercase tracking-wide">Coming soon</div>}
                </th>
              ))}
              {data.canEdit && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => (
              <tr key={`${p.subject_type}:${p.id}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.claude_connected && <Badge tone="success" title={p.claude_last_used ? `Last used ${new Date(p.claude_last_used).toLocaleString()}` : undefined}>Claude connected</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{kindLabel(p)}{p.company ? ` · ${p.company}` : ""}{p.email ? ` · ${p.email}` : ""}</div>
                </td>
                {caps.map((c) => {
                  const applies = c.appliesTo.includes(p.subject_type);
                  const overridden = c.key in p.explicit;
                  return (
                    <td key={c.key} className="px-2 py-2 text-center">
                      {applies ? (
                        <span className="inline-flex items-center gap-1">
                          <Toggle on={!!p.effective[c.key]} disabled={!data.canEdit || busy === `${p.id}:${c.key}`}
                            label={`${c.label} for ${p.name}`} onClick={() => toggle(p, c)} />
                          {overridden && c.defaultRoles && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Set for this person (differs from role default)" />}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  );
                })}
                {data.canEdit && (
                  <td className="px-2 py-2 text-center">
                    <button type="button" onClick={() => remove(p)} disabled={busy === p.id} aria-label={`Remove ${p.name}`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={caps.length + 2} className="px-3 py-6 text-center text-sm text-muted-foreground">No one matches these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {data.canEdit && <BulkRole caps={caps} onApply={async (role, capability, enabled) => {
        await send("POST", { role, capability, enabled });
        await load();
      }} />}

      <p className="text-xs text-muted-foreground">
        A dot means the setting was changed for that person and differs from their role&apos;s default. Receiving AI
        email or SMS never overrides someone&apos;s opt-out. Consent is always checked before anything is sent.
      </p>
    </div>
  );
}

function ConnectorCard({ url, connected, copied, onCopy }: { url: string; connected: number; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-accent" /> CMI connector for Claude</div>
      <p className="mt-1 text-xs text-muted-foreground">
        In Claude Team, go to Admin settings → Connectors and add a custom connector with this URL. Each person then connects it and signs in with their CMI dashboard account.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{url}</code>
        <Button type="button" size="sm" variant="outline" onClick={onCopy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{connected} {connected === 1 ? "person has" : "people have"} Claude connected.</p>
    </div>
  );
}

function AddPerson({ onAdd }: { onAdd: (r: SearchResult) => void }) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/ai-access?search=${encodeURIComponent(term)}`);
        const json = (await res.json()) as { results?: SearchResult[] };
        setResults(json.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="relative">
        <UserPlus className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a person: search staff of any role, clients, vendors or contacts" className="pl-8" />
        {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {results && q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {results.length ? results.map((r) => (
            <button key={`${r.subject_type}:${r.id}`} type="button" onClick={() => { onAdd(r); setQ(""); setResults(null); }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.email ?? "No email"}{r.company ? ` · ${r.company}` : ""}</span>
              </span>
              <Badge>{kindLabel(r)}</Badge>
            </button>
          )) : <div className="px-3 py-2 text-sm text-muted-foreground">No matches.</div>}
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Added people appear in the table. Switch on what they should have to save them.</p>
    </div>
  );
}

function BulkRole({ caps, onApply }: { caps: Capability[]; onApply: (role: string, capability: string, enabled: boolean | null) => Promise<void> }) {
  const staffCaps = caps.filter((c) => c.appliesTo.includes("staff"));
  const [role, setRole] = React.useState("project_manager");
  const [cap, setCap] = React.useState(staffCaps[0]?.key ?? "");
  const [mode, setMode] = React.useState<"on" | "off" | "reset">("on");
  const [state, setState] = React.useState<"idle" | "saving" | "done" | "error">("idle");

  async function apply() {
    const capLabel = staffCaps.find((c) => c.key === cap)?.label ?? cap;
    const ok = await confirmAction({
      title: `Apply to every ${ROLE_LABELS[role] ?? role}?`,
      body: `${capLabel} will be ${mode === "reset" ? "reset to the default" : mode === "on" ? "turned on" : "turned off"} for everyone with this role.`,
      confirmLabel: "Apply",
    });
    if (!ok) return;
    setState("saving");
    try {
      await onApply(role, cap, mode === "reset" ? null : mode === "on");
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-sm font-medium">Set for a whole role</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className="w-44">
          {STAFF_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
        <Select value={cap} onChange={(e) => setCap(e.target.value)} aria-label="Capability" className="w-48">
          {staffCaps.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>
        <Select value={mode} onChange={(e) => setMode(e.target.value as "on" | "off" | "reset")} aria-label="Setting" className="w-36">
          <option value="on">Turn on</option>
          <option value="off">Turn off</option>
          <option value="reset">Reset to default</option>
        </Select>
        <Button type="button" size="sm" variant="accent" onClick={apply} disabled={state === "saving"}>
          {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apply
        </Button>
        {state === "done" && <span className="text-xs text-success">Saved.</span>}
        {state === "error" && <span className="text-xs text-destructive">Couldn&apos;t save. Try again.</span>}
      </div>
    </div>
  );
}
