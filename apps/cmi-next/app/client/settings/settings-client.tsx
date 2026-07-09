"use client";

import * as React from "react";

export function SettingsClient({ initial }: { initial: { email_enabled: boolean; sms_enabled: boolean; phone: string | null } }) {
  const [email, setEmail] = React.useState(initial.email_enabled);
  const [sms, setSms] = React.useState(initial.sms_enabled);
  const [saved, setSaved] = React.useState<string | null>(null);

  async function patch(next: { email_enabled?: boolean; sms_enabled?: boolean }) {
    setSaved(null);
    try {
      const res = await fetch("/api/client/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (res.ok) setSaved("Saved");
    } catch { /* */ }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 font-display text-2xl font-semibold tracking-tight">Notification Settings</h1>
      <p className="mb-5 text-sm text-muted-foreground">Choose how we notify you about project updates, messages, approvals, and action items. You&apos;ll always see notifications in this portal.</p>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        <Row title="Email" desc="Send notifications to your email." checked={email} onChange={(v) => { setEmail(v); void patch({ email_enabled: v }); }} />
        <Row
          title="Text message (SMS)"
          desc={initial.phone ? `Send texts to ${initial.phone}. Message & data rates may apply; reply STOP to opt out.` : "Add a phone number with your project manager to enable texts."}
          checked={sms}
          disabled={!initial.phone}
          onChange={(v) => { setSms(v); void patch({ sms_enabled: v }); }}
        />
      </div>
      {saved && <div className="mt-3 text-sm text-success">{saved}</div>}
    </div>
  );
}

function Row({ title, desc, checked, onChange, disabled }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-4 px-4 py-4 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0" />
    </label>
  );
}
