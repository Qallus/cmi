"use client";

import * as React from "react";
import { Check, Loader2, Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Audience = "all" | "staff" | "clients" | "role";
type Broadcast = { id: string; title: string; body: string; link: string | null; audience: Audience; target_role: string | null; created_by_name: string | null; created_at: string };

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "all", label: "Everyone (staff + clients)" },
  { value: "staff", label: "All staff" },
  { value: "clients", label: "All clients" },
  { value: "role", label: "A specific staff role" },
];
const ROLES = ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "subcontractor", "vendor", "staff", "viewer"];

export function NotificationsClient() {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [link, setLink] = React.useState("");
  const [audience, setAudience] = React.useState<Audience>("all");
  const [role, setRole] = React.useState("project_manager");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<Broadcast[]>([]);

  const load = React.useCallback(() => {
    fetch("/api/notifications/broadcasts").then((r) => r.json()).then((d: { broadcasts?: Broadcast[] }) => setHistory(d.broadcasts ?? [])).catch(() => {});
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function send() {
    if (!title.trim() || !body.trim() || sending) return;
    setSending(true);
    setError(null);
    setSent(null);
    try {
      const res = await fetch("/api/notifications/broadcasts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, link: link || undefined, audience, target_role: audience === "role" ? role : undefined }),
      });
      const json = (await res.json()) as { error?: string; delivered?: { staffPush: number; clients: number } };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSent(`Sent — ${json.delivered?.staffPush ?? 0} staff push, ${json.delivered?.clients ?? 0} client${json.delivered?.clients === 1 ? "" : "s"} notified.`);
      setTitle(""); setBody(""); setLink("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle>Compose a broadcast</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="What's happening?" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          </Field>
          <Field label="Message">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} placeholder="Write your announcement…" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          </Field>
          <Field label="Link (optional)">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/dashboard/jobs or https://…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience">
              <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            {audience === "role" && (
              <Field label="Staff role">
                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </Field>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {sent && <p className="flex items-center gap-1.5 text-sm text-[#2e7d5b]"><Check className="h-4 w-4" />{sent}</p>}
          <div className="flex justify-end">
            <Button variant="accent" onClick={send} disabled={sending || !title.trim() || !body.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send broadcast
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent broadcasts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : history.map((b) => (
            <div key={b.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-accent" />
                <span className="text-sm font-semibold">{b.title}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{b.body}</p>
              <div className="mt-1.5 text-[11px] text-muted-foreground">{audienceLabel(b)} · {new Date(b.created_at).toLocaleString()}{b.created_by_name ? ` · ${b.created_by_name}` : ""}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function audienceLabel(b: Broadcast): string {
  if (b.audience === "role") return `Role: ${(b.target_role ?? "").replace(/_/g, " ")}`;
  return AUDIENCES.find((a) => a.value === b.audience)?.label ?? b.audience;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
