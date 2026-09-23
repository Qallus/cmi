"use client";

import * as React from "react";
import { AlertTriangle, Check, Loader2, Merge, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  type: string | null;
  notes: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lead_owner: string | null;
  tags: string[] | null;
  last_activity: string | null;
  created_at: string;
  activity: number;
};

type Group = { key: string; reason: string; members: Member[] };

const name = (m: Member) => `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Unnamed";
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "never";

/** Fields offered as a choice when the records disagree. */
const FIELDS: { key: keyof Member; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "type", label: "Type" },
  { key: "lead_owner", label: "Lead owner" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "notes", label: "Notes" },
];

export function MergeDuplicates({ onMerged }: { onMerged?: () => void }) {
  const [groups, setGroups] = React.useState<Group[] | null>(null);
  const [active, setActive] = React.useState<Group | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/contacts/merge");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setGroups(json.groups ?? []);
    else { setGroups([]); setError(json.error ?? "Couldn't load duplicates."); }
  }, []);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetch("/api/contacts/merge");
      const json = await res.json().catch(() => ({}));
      if (!alive) return;
      if (res.ok) setGroups(json.groups ?? []);
      else { setGroups([]); setError(json.error ?? "Couldn't load duplicates."); }
    })();
    return () => { alive = false; };
  }, []);

  if (groups === null) {
    return <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Looking for duplicates…</p>;
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No duplicates found</p>
        <p className="mt-1 text-sm text-muted-foreground">Nothing shares a name or phone number.</p>
      </div>
    );
  }

  const total = groups.reduce((sum, g) => sum + g.members.length, 0);

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <p className="text-sm text-muted-foreground">
        {groups.length} group{groups.length === 1 ? "" : "s"} covering {total} contacts. Merging keeps one record and
        moves everything attached to the others onto it — deals, notes, appointments, messages and history.
      </p>

      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.key} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{name(g.members[0])}</p>
                <p className="text-xs text-muted-foreground">{g.members.length} records · matched on {g.reason}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActive(g)}>
                <Merge className="h-3.5 w-3.5" /> Review
              </Button>
            </div>
            <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {g.members.map((m) => (
                <li key={m.id} className="truncate">
                  {m.email}{m.phone ? ` · ${m.phone}` : ""}{m.company ? ` · ${m.company}` : ""}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {active && (
        <MergeDialog
          group={active}
          onClose={() => setActive(null)}
          onDone={async () => { setActive(null); await load(); onMerged?.(); }}
        />
      )}
    </div>
  );
}

function MergeDialog({ group, onClose, onDone }: { group: Group; onClose: () => void; onDone: () => Promise<void> }) {
  // Default to the record with the most attached to it.
  const [survivorId, setSurvivorId] = React.useState(
    () => [...group.members].sort((a, b) => b.activity - a.activity)[0].id,
  );
  const [choices, setChoices] = React.useState<Partial<Record<keyof Member, string>>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const survivor = group.members.find((m) => m.id === survivorId)!;
  const losers = group.members.filter((m) => m.id !== survivorId);

  // Fields where the records genuinely disagree and a choice is needed.
  const conflicts = FIELDS.map((f) => {
    const values = [...new Set(group.members.map((m) => (m[f.key] as string | null) ?? "").filter(Boolean))];
    return { ...f, values };
  }).filter((f) => f.values.length > 1);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function merge() {
    setBusy(true); setError(null);
    // Only send fields where a value other than the survivor's was picked.
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(choices)) {
      if (value && value !== ((survivor[key as keyof Member] as string | null) ?? "")) patch[key] = value;
    }

    const res = await fetch("/api/contacts/merge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survivor_id: survivorId, loser_ids: losers.map((m) => m.id), patch }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Merge failed."); setBusy(false); return; }
    await onDone();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Merge duplicate contacts" className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-serif text-lg">Merge {name(group.members[0])}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Which record to keep</p>
            <div className="space-y-1.5">
              {group.members.map((m) => (
                <label key={m.id} className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm",
                  m.id === survivorId ? "border-accent bg-accent/10" : "border-border hover:bg-muted/50",
                )}>
                  <input type="radio" className="mt-1" name="survivor" checked={m.id === survivorId} onChange={() => setSurvivorId(m.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.email}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[m.phone, m.company, m.type].filter(Boolean).join(" · ") || "no other details"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Added {when(m.created_at)} · last activity {when(m.last_activity)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {conflicts.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Which details to keep</p>
              <div className="space-y-2">
                {conflicts.map((f) => {
                  const current = choices[f.key] ?? ((survivor[f.key] as string | null) ?? "");
                  return (
                    <div key={String(f.key)} className="rounded-md border border-border p-2.5">
                      <p className="mb-1 text-xs font-medium">{f.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {f.values.map((v) => (
                          <button
                            key={v} type="button"
                            onClick={() => setChoices((c) => ({ ...c, [f.key]: v }))}
                            className={cn(
                              "max-w-full truncate rounded-md border px-2 py-1 text-xs",
                              current === v ? "border-accent bg-accent/10 font-medium" : "border-border hover:bg-muted",
                            )}
                          >
                            {current === v && <Check className="mr-1 inline h-3 w-3" />}{v}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {losers.length} record{losers.length === 1 ? "" : "s"} will be deleted. Everything attached —
              deals, notes, appointments, messages, bookings — moves onto the record you keep first. The merge is
              logged, but it can&apos;t be undone.
            </span>
          </p>

          {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="accent" disabled={busy} onClick={() => void merge()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
            Merge {losers.length + 1} into 1
          </Button>
        </div>
      </div>
    </div>
  );
}
