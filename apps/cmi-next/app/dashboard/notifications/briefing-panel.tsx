"use client";

// Notifications → Morning Briefing. Super Admin controls for the daily email:
// the automatic 6 AM send, an on-demand send, per-person previews and history.
import * as React from "react";
import { Check, Clock, Eye, Loader2, RefreshCw, Save, Send, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Settings = { auto_enabled: boolean; audience: "all" | "selected"; recipient_ids: string[]; include_ai: boolean; updated_at: string | null };
type Staff = { id: string; name: string; email: string; role: string; status: string; emailOff: boolean };
type HistoryRow = { id: string; recipient: string; status: string; created_at: string; sent_at: string | null; error: string | null; subject: string | null; trigger: string | null; sent_by: string | null; summary_from_ai: boolean | null };
type RunResult = { sent: string[]; skipped: { email: string; reason: string }[]; failed: { email: string; error: string }[] };
type Payload = { settings: Settings; staff: Staff[]; history: HistoryRow[]; envOverride: string | null };

const roleLabel = (r: string) => r.replace(/_/g, " ");

export function BriefingPanel() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Automatic-send settings (saved).
  const [draft, setDraft] = React.useState<Settings | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  // Send now.
  const [sendTo, setSendTo] = React.useState<"all" | "selected">("selected");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [force, setForce] = React.useState(true);
  const [includeAi, setIncludeAi] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [sendError, setSendError] = React.useState<string | null>(null);

  const [previewId, setPreviewId] = React.useState<string>("");

  // Refreshes keep whatever is being edited; only the first load seeds the form.
  const seeded = React.useRef(false);
  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/briefing");
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
      if (!seeded.current) {
        seeded.current = true;
        setDraft(json.settings);
        setIncludeAi(json.settings.include_ai);
        setPreviewId(json.staff[0]?.id ?? "");
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load the briefing settings.");
    }
  }, []);
  React.useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    setSavedAt(null);
    try {
      const res = await fetch("/api/notifications/briefing", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_enabled: draft.auto_enabled, audience: draft.audience, recipient_ids: draft.recipient_ids, include_ai: draft.include_ai }),
      });
      const json = (await res.json()) as { settings?: Settings; error?: string };
      if (!res.ok || json.error || !json.settings) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDraft(json.settings);
      setData((d) => (d ? { ...d, settings: json.settings as Settings } : d));
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    if (sending) return;
    if (sendTo === "selected" && !picked.length) { setSendError("Choose at least one person."); return; }
    setSending(true);
    setSendError(null);
    setResult(null);
    try {
      const res = await fetch("/api/notifications/briefing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientIds: sendTo === "all" ? "all" : picked, force, includeAi }),
      });
      const json = (await res.json()) as RunResult & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json);
      void load();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  if (loadError && !data) return <Card><CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent></Card>;
  if (!data || !draft) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>;

  const dirty = JSON.stringify({ ...draft, updated_at: null }) !== JSON.stringify({ ...data.settings, updated_at: null });
  const sendCount = sendTo === "all" ? data.staff.length : picked.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* ── Automatic daily send ── */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> Automatic daily send</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Goes out every morning at 6:00 AM Arizona time. Each person gets one a day, and anyone who has turned off email notifications is skipped.</p>
            </div>
            <Badge tone={draft.auto_enabled ? "success" : "warning"}>{draft.auto_enabled ? "On" : "Paused"}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.envOverride && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                The server setting <code>BRIEFING_AUDIENCE={data.envOverride}</code> is overriding who receives the automatic send. Remove it in Coolify to use the options below.
              </p>
            )}
            <Toggle label="Send the briefing automatically every morning" checked={draft.auto_enabled} onChange={(v) => setDraft({ ...draft, auto_enabled: v })} />
            <Toggle label="Include the AI summary (“Here's what needs you today”)" hint="Off uses a plain sentence built from the counts." checked={draft.include_ai} onChange={(v) => setDraft({ ...draft, include_ai: v })} />
            <Field label="Who receives it">
              <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as Settings["audience"] })} className={inputCls}>
                <option value="all">All staff ({data.staff.length})</option>
                <option value="selected">Only the people selected below</option>
              </select>
            </Field>
            {draft.audience === "selected" && (
              <StaffPicker staff={data.staff} value={draft.recipient_ids} onChange={(ids) => setDraft({ ...draft, recipient_ids: ids })} />
            )}
            <div className="flex items-center justify-end gap-3">
              {savedAt && !dirty && <span className="flex items-center gap-1 text-xs text-[#2e7d5b]"><Check className="h-3.5 w-3.5" /> Saved {savedAt}</span>}
              <Button variant="accent" onClick={save} disabled={!dirty || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Send now ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-accent" /> Send now</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Push today&apos;s briefing out on demand, with everything current as of right now.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Send to">
              <select value={sendTo} onChange={(e) => setSendTo(e.target.value as "all" | "selected")} className={inputCls}>
                <option value="selected">Selected people</option>
                <option value="all">All staff ({data.staff.length})</option>
              </select>
            </Field>
            {sendTo === "selected" && <StaffPicker staff={data.staff} value={picked} onChange={setPicked} />}
            <Toggle label="Send even if they already received today's briefing" checked={force} onChange={setForce} />
            <Toggle label="Include the AI summary" hint="Adds a few seconds per person." checked={includeAi} onChange={setIncludeAi} />
            {sendError && <p className="text-sm text-destructive">{sendError}</p>}
            {result && <RunSummary result={result} />}
            <div className="flex justify-end">
              <Button variant="accent" onClick={sendNow} disabled={sending || !sendCount}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sun className="h-4 w-4" />}
                {sending ? `Sending to ${sendCount}…` : `Send briefing to ${sendCount} ${sendCount === 1 ? "person" : "people"}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* ── Preview ── */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-4 w-4 text-accent" /> Preview</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">See exactly what someone&apos;s email looks like right now. Nothing is sent.</p>
            <select value={previewId} onChange={(e) => setPreviewId(e.target.value)} className={inputCls}>
              {data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button variant="outline" className="w-full" disabled={!previewId}
              onClick={() => window.open(`/api/notifications/briefing/preview?staffId=${previewId}&ai=${includeAi ? 1 : 0}`, "_blank", "noopener")}>
              <Eye className="h-4 w-4" /> Open preview
            </Button>
          </CardContent>
        </Card>

        {/* ── History ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent sends</CardTitle>
            <button type="button" onClick={() => void load()} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
          </CardHeader>
          <CardContent>
            {data.history.length === 0 ? <p className="text-sm text-muted-foreground">Nothing sent yet.</p> : (
              <ul className="divide-y divide-border">
                {data.history.map((h) => (
                  <li key={h.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{nameFor(data.staff, h.recipient)}</span>
                      <Badge tone={h.status === "sent" ? "success" : h.status === "failed" ? "danger" : "default"}>{h.status}</Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {" · "}{h.trigger === "manual" ? `Manual${h.sent_by ? ` by ${h.sent_by}` : ""}` : h.trigger === "test" ? "Test" : "Automatic"}
                      {h.summary_from_ai === false ? " · plain summary" : ""}
                    </div>
                    {h.error && <div className="mt-0.5 text-[11px] text-destructive">{h.error}</div>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function nameFor(staff: Staff[], email: string): string {
  return staff.find((s) => s.email.toLowerCase() === email.toLowerCase())?.name ?? email;
}

function StaffPicker({ staff, value, onChange }: { staff: Staff[]; value: string[]; onChange: (ids: string[]) => void }) {
  const all = value.length === staff.length;
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{value.length} of {staff.length} selected</span>
        <button type="button" className="font-medium text-accent hover:underline" onClick={() => onChange(all ? [] : staff.map((s) => s.id))}>{all ? "Clear" : "Select all"}</button>
      </div>
      <ul className="max-h-64 divide-y divide-border overflow-y-auto">
        {staff.map((s) => {
          const on = value.includes(s.id);
          return (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted">
                <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])} className="h-4 w-4 accent-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.email} · {roleLabel(s.role)}</span>
                </span>
                {s.status === "invited" && <Badge>Invited</Badge>}
                {s.emailOff && <Badge tone="warning">Email off</Badge>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RunSummary({ result }: { result: RunResult }) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      {result.sent.length > 0 && <p className="flex items-center gap-1.5 text-[#2e7d5b]"><Check className="h-4 w-4" /> Sent to {result.sent.length}: {result.sent.join(", ")}</p>}
      {result.skipped.map((s) => <p key={s.email} className="text-xs text-muted-foreground">Skipped {s.email}: {s.reason}</p>)}
      {result.failed.map((f) => <p key={f.email} className="text-xs text-destructive">Failed {f.email}: {f.error}</p>)}
      {!result.sent.length && !result.skipped.length && !result.failed.length && <p className="text-xs text-muted-foreground">Nobody matched.</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
