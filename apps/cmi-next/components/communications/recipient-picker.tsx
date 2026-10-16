"use client";

// Choose who to call, text or email from a job's people, or enter a number /
// address by hand. When the chosen person has no phone or email on file, it
// can be typed here and saved to their contact for next time.
import * as React from "react";
import { Check, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PhoneInput } from "@/components/ui/formatted-input";
import type { ComposeRecipient } from "./compose-dialog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANUAL = "__manual__";
const inputCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

export function RecipientPicker({ recipients, kind, label, onUse, onSaved, placeholder }: {
  recipients: ComposeRecipient[];
  kind: "phone" | "email";
  label?: string;
  /** Address to use, and who it belongs to (null for a typed-in one). */
  onUse: (address: string, who: ComposeRecipient | null) => void;
  /** A missing phone / email was saved to this contact. */
  onSaved?: (who: ComposeRecipient, address: string) => void;
  placeholder?: string;
}) {
  const [pick, setPick] = React.useState("");
  const [entry, setEntry] = React.useState("");
  const [save, setSave] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usedKey, setUsedKey] = React.useState<string | null>(null);

  const field = (r: ComposeRecipient) => (kind === "phone" ? r.phone : r.email);
  const noun = kind === "phone" ? "phone number" : "email address";
  const chosen = recipients.find((r) => r.key === pick) ?? null;
  const needsEntry = pick === MANUAL || (chosen && !field(chosen));

  const options = [
    ...recipients.map((r) => ({
      value: r.key,
      label: `${r.name} · ${r.role}`,
      sublabel: field(r) ?? `No ${noun} yet. Add one`,
    })),
    { value: MANUAL, label: `Enter a ${noun}`, sublabel: "Someone not listed on this job" },
  ];

  function choose(key: string) {
    setPick(key); setEntry(""); setError(null); setUsedKey(null);
    const r = recipients.find((x) => x.key === key);
    if (r && field(r)) { onUse(field(r) as string, r); setUsedKey(key); }
  }

  const valid = kind === "email" ? EMAIL_RE.test(entry.trim()) : entry.replace(/\D/g, "").length >= 10;

  async function applyEntry() {
    if (!valid) { setError(`Enter a valid ${noun}.`); return; }
    const address = kind === "email" ? entry.trim().toLowerCase() : entry.trim();
    if (chosen && save && chosen.contactId) {
      setBusy(true); setError(null);
      const res = await fetch(`/api/contacts/${chosen.contactId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "phone" ? { phone: address } : { email: address }),
      });
      setBusy(false);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || `Couldn't save the ${noun} to ${chosen.name}.`);
        return;
      }
      onSaved?.(chosen, address);
    }
    onUse(address, chosen);
    setUsedKey(pick);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
        <SearchableSelect options={options} value={pick} onChange={choose} placeholder={placeholder ?? (kind === "phone" ? "Choose who to reach, or enter a number…" : "Choose a client, sub or team member…")} />
      </div>
      {needsEntry && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Keyboard className="h-3.5 w-3.5" />
            {chosen ? <>No {noun} on file for <strong className="text-foreground">{chosen.name}</strong>.</> : <>Enter the {noun}.</>}
          </div>
          <div className="flex gap-2">
            {kind === "phone"
              ? <PhoneInput className={inputCls} value={entry} onChange={setEntry} placeholder="(602) 555-0100" />
              : <input type="email" className={inputCls} value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="name@example.com" />}
            <Button size="sm" variant="accent" onClick={() => void applyEntry()} disabled={busy || !entry.trim()}>
              {usedKey === pick ? <Check className="h-3.5 w-3.5" /> : null}{busy ? "Saving…" : "Use"}
            </Button>
          </div>
          {chosen?.contactId && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save to {chosen.name}&apos;s contact
            </label>
          )}
          {chosen && !chosen.contactId && <p className="text-[11px] text-muted-foreground">Team members&apos; details are managed in Team settings; this is used for this message only.</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
