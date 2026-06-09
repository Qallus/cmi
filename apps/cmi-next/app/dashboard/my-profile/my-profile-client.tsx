"use client";

import * as React from "react";
import { Check, Mail, Phone, User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TeamMember, TeamMemberDraft } from "@/lib/team/types";

export function MyProfileClient({ profile }: { profile: TeamMember | null }) {
  const [member, setMember] = React.useState<TeamMember | null>(profile);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Partial<TeamMemberDraft>>({});
  const [attrInput, setAttrInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function startEdit() {
    if (!member) return;
    setDraft({ name: member.name, role: member.role ?? "", department: member.department ?? "", bio: member.bio ?? "", tagline: member.tagline ?? "", email: member.email ?? "", phone: member.phone ?? "", profile_photo: member.profile_photo ?? "", secondary_photo: member.secondary_photo ?? "", attributes: member.attributes ?? [], availability: member.availability ?? "" });
    setAttrInput("");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setError(null); }

  function addAttr() {
    const a = attrInput.trim();
    if (!a || (draft.attributes ?? []).includes(a)) { setAttrInput(""); return; }
    setDraft((d) => ({ ...d, attributes: [...(d.attributes ?? []), a] }));
    setAttrInput("");
  }

  async function save() {
    if (!member) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const json = await res.json() as TeamMember & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMember(json);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setSaving(false); }
  }

  if (!member) {
    return (
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Account</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">My Profile</h1>
        </div>
        <Card className="max-w-lg">
          <CardContent className="py-12 text-center">
            <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No team member record linked to your account.</p>
            <p className="mt-1 text-xs text-muted-foreground">Go to <strong>Team</strong> and add a member with your email address.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Account</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">My Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your public team profile visible on the website.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" /> Saved</span>}
          {!editing && <Button size="sm" variant="outline" onClick={startEdit}>Edit Profile</Button>}
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl lg:grid-cols-[auto_1fr]">
        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-border bg-muted">
            {member.profile_photo ? (
              <img src={member.profile_photo} alt={member.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center"><User className="h-12 w-12 text-muted-foreground/40" /></div>
            )}
          </div>
          <Badge tone={member.status === "active" ? "success" : "warning"}>{member.status}</Badge>
        </div>

        {/* Info */}
        {!editing ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{member.name}</h2>
              {member.role && <div className="text-sm text-muted-foreground">{member.role}{member.department ? ` · ${member.department}` : ""}</div>}
              {member.tagline && <p className="mt-1 text-sm italic text-muted-foreground">"{member.tagline}"</p>}
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              {member.email && <span className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{member.email}</span>}
              {member.phone && <span className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{member.phone}</span>}
            </div>
            {member.bio && <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>}
            {(member.attributes ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(member.attributes ?? []).map((a) => <span key={a} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{a}</span>)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Name"><input className={iCls} value={draft.name ?? ""} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></F>
              <F label="Job Title"><input className={iCls} value={draft.role ?? ""} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))} /></F>
              <F label="Department"><input className={iCls} value={draft.department ?? ""} onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))} /></F>
              <F label="Phone"><input type="tel" className={iCls} value={draft.phone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></F>
            </div>
            <F label="Tagline"><input className={iCls} value={draft.tagline ?? ""} onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))} /></F>
            <F label="Bio">
              <textarea className={cn(iCls, "min-h-[80px] resize-none")} value={draft.bio ?? ""} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} />
            </F>
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Profile Photo URL"><input className={iCls} value={draft.profile_photo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, profile_photo: e.target.value }))} /></F>
              <F label="Secondary Photo URL"><input className={iCls} value={draft.secondary_photo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, secondary_photo: e.target.value }))} /></F>
            </div>
            <F label="Key Attributes">
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
                {(draft.attributes ?? []).map((a) => (
                  <span key={a} className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                    {a}<button type="button" onClick={() => setDraft((d) => ({ ...d, attributes: (d.attributes ?? []).filter((x) => x !== a) }))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <input
                  className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Add attribute…"
                  value={attrInput}
                  onChange={(e) => setAttrInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addAttr(); } }}
                />
              </div>
            </F>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>Cancel</Button>
              <Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const iCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}
