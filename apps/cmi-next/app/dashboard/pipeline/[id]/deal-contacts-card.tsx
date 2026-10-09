"use client";

// Lead / Contact details: everyone on the deal, typed in place.
//
// Each block is a real Contact. Fields save when you leave them, so there is
// no form to submit. A blank block (the first contact on an empty deal, or one
// added with "Add contact") becomes a Contact the moment anything is typed.
// Everything is optional: a designer may not share their client's phone or
// email until contracts are signed.
import * as React from "react";
import { ExternalLink, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DealContact } from "./deal-detail-client";

type Row = {
  id: string; contact_id: string; role: string | null; is_primary: boolean;
  first_name: string; last_name: string; email: string | null; phone: string | null; company: string | null;
};
type Fields = { first_name: string; last_name: string; phone: string; email: string; role: string };

const ROLES = ["Homeowner", "Designer", "Architect", "General Contractor", "Referral Partner", "Property Manager", "Realtor", "Other"];
const EMPTY: Fields = { first_name: "", last_name: "", phone: "", email: "", role: "" };

const ordinal = (i: number) => (i === 0 ? "Primary contact" : i === 1 ? "Secondary contact" : `Contact ${i + 1}`);

export function DealContactsCard({
  dealId, canWrite, onPrimaryChange,
}: {
  dealId: string; canWrite: boolean; onPrimaryChange: (c: DealContact | null) => void;
}) {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [drafts, setDrafts] = React.useState<number[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const nextDraft = React.useRef(1);

  const apply = React.useCallback((list: Row[]) => {
    setRows(list);
    const p = list.find((r) => r.is_primary) ?? null;
    onPrimaryChange(p ? {
      id: p.contact_id, name: `${p.first_name} ${p.last_name}`.trim() || p.email || p.phone || "Contact",
      email: p.email, phone: p.phone, company: p.company, role: p.role, tags: null,
    } : null);
  }, [onPrimaryChange]);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/deals/${dealId}/contacts`).then((r) => (r.ok ? r.json() : [])).then((list: Row[]) => { if (live) apply(list); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [dealId, apply]);

  async function send(url: string, init: RequestInit): Promise<boolean> {
    setError(null);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError((json as { error?: string }).error ?? "That didn't save."); return false; }
    apply(json as Row[]);
    return true;
  }

  if (rows === null) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…</p>;

  // An empty deal opens with a blank primary contact, ready to type into.
  const draftKeys = rows.length === 0 && canWrite ? [0, ...drafts] : drafts;

  return (
    <div className="space-y-3">
      {rows.length === 0 && !canWrite && <p className="text-sm text-muted-foreground">No contact linked to this deal.</p>}

      {rows.map((row, i) => (
        <ContactBlock
          key={row.id}
          label={ordinal(i)}
          initial={{ first_name: row.first_name, last_name: row.last_name, phone: row.phone ?? "", email: row.email ?? "", role: row.role ?? "" }}
          canWrite={canWrite}
          isPrimary={row.is_primary}
          contactId={row.contact_id}
          onSave={(patch) => send(`/api/deals/${dealId}/contacts/${row.id}`, { method: "PATCH", body: JSON.stringify(patch) })}
          onMakePrimary={() => void send(`/api/deals/${dealId}/contacts/${row.id}`, { method: "PATCH", body: JSON.stringify({ is_primary: true }) })}
          onRemove={() => {
            if (!window.confirm("Take this person off the deal? They stay in Contacts.")) return;
            void send(`/api/deals/${dealId}/contacts/${row.id}`, { method: "DELETE" });
          }}
        />
      ))}

      {draftKeys.map((key, j) => (
        <ContactBlock
          key={`draft-${key}`}
          label={ordinal(rows.length + j)}
          initial={EMPTY}
          canWrite={canWrite}
          isPrimary={false}
          onSave={async (patch, all) => {
            // Picking a role alone doesn't make a person yet; it rides along
            // with the first name, phone or email typed.
            const merged = { ...all, ...patch };
            if (![merged.first_name, merged.last_name, merged.phone, merged.email].some((v) => v.trim())) return false;
            // The first field typed creates the Contact with everything entered so far.
            const ok = await send(`/api/deals/${dealId}/contacts`, { method: "POST", body: JSON.stringify({ ...all, ...patch }) });
            if (ok) setDrafts((d) => d.filter((k) => k !== key));
            return ok;
          }}
          onRemove={() => setDrafts((d) => d.filter((k) => k !== key))}
        />
      ))}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {canWrite && (
        <button
          type="button"
          onClick={() => setDrafts((d) => [...d, nextDraft.current++])}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-accent/50 hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Add contact
        </button>
      )}
    </div>
  );
}

function ContactBlock({
  label, initial, canWrite, isPrimary, contactId, onSave, onMakePrimary, onRemove,
}: {
  label: string; initial: Fields; canWrite: boolean; isPrimary: boolean; contactId?: string;
  onSave: (patch: Partial<Fields>, all: Fields) => Promise<boolean>;
  onMakePrimary?: () => void; onRemove: () => void;
}) {
  const [f, setF] = React.useState<Fields>(initial);
  const [saving, setSaving] = React.useState(false);
  const saved = React.useRef<Fields>(initial);

  async function commit(key: keyof Fields, value: string) {
    if (value.trim() === saved.current[key].trim()) return;
    setSaving(true);
    const ok = await onSave({ [key]: value }, { ...f, [key]: value });
    setSaving(false);
    if (ok) saved.current = { ...saved.current, [key]: value };
  }

  const input = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none transition focus:border-accent disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:px-0";
  const field = (key: keyof Fields, placeholder: string, type = "text") => (
    <input
      type={type}
      value={f[key]}
      placeholder={canWrite ? placeholder : "—"}
      disabled={!canWrite}
      onChange={(e) => setF((s) => ({ ...s, [key]: e.target.value }))}
      onBlur={(e) => void commit(key, e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      aria-label={`${label}: ${placeholder}`}
      className={input}
    />
  );

  return (
    <div className={cn("rounded-md border p-3", isPrimary ? "border-accent/40 bg-accent/5" : "border-border")}>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("text-[11px] font-semibold uppercase tracking-[0.1em]", isPrimary ? "text-accent" : "text-muted-foreground")}>{label}</span>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <span className="flex-1" />
        {contactId && (
          <a href={`/dashboard/contacts?id=${contactId}`} title="Open in Contacts" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {canWrite && contactId && !isPrimary && onMakePrimary && (
          <button type="button" onClick={onMakePrimary} title="Make primary contact" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-accent">
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
        {canWrite && (
          <button type="button" onClick={onRemove} title={contactId ? "Take off this deal" : "Discard"} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {field("first_name", "First name")}
        {field("last_name", "Last name")}
        {field("phone", "Phone", "tel")}
        {field("email", "Email", "email")}
        <select
          value={f.role}
          disabled={!canWrite}
          onChange={(e) => { setF((s) => ({ ...s, role: e.target.value })); void commit("role", e.target.value); }}
          aria-label={`${label}: Relation to the deal`}
          className={cn(input, "sm:col-span-2")}
        >
          <option value="">Relation to the deal…</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
    </div>
  );
}
