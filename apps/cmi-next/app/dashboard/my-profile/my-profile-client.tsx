"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Eye, Image, Mail, Phone, Plus, Sparkles, User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { PhotoField } from "@/components/ui/photo-field";
import { cn } from "@/lib/utils";
import { slugForTeamMember } from "@/lib/team/fallback";
import type { TeamMember, TeamMemberDraft } from "@/lib/team/types";

export function MyProfileClient({ profile }: { profile: TeamMember | null }) {
  const [member, setMember] = React.useState<TeamMember | null>(profile);
  const [editing, setEditing] = React.useState(Boolean(!profile));
  const [draft, setDraft] = React.useState<Partial<TeamMemberDraft>>(() => profileToDraft(profile));
  const [attrInput, setAttrInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setMember(profile);
    setDraft(profileToDraft(profile));
    setEditing(Boolean(!profile));
  }, [profile]);

  const preview = { ...(member ?? fallbackPreview()), ...draft } as TeamMember;
  const publicHref = `/team/${slugForTeamMember(preview)}`;

  function startEdit() {
    setDraft(profileToDraft(member));
    setAttrInput("");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(profileToDraft(member));
    setEditing(false);
    setError(null);
  }

  function addAttr() {
    const value = attrInput.trim();
    if (!value || (draft.attributes ?? []).includes(value)) {
      setAttrInput("");
      return;
    }
    setDraft(current => ({ ...current, attributes: [...(current.attributes ?? []), value] }));
    setAttrInput("");
  }

  async function save() {
    if (!member) {
      setError("No linked team member record was found. Add your team member in Dashboard > Team first.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/team-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const json = await res.json() as TeamMember & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMember(json);
      setDraft(profileToDraft(json));
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Account</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">My Profile</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Manage the public team profile connected to your staff account. Updates here feed the team card and individual team member page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saved ? <span className="flex items-center gap-1 text-xs font-medium text-success"><Check className="h-3.5 w-3.5" /> Saved</span> : null}
          <Link
            href={publicHref}
            target="_blank"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-transparent px-2.5 text-xs font-medium transition hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" />
            View Public Page
          </Link>
          {!editing ? <Button size="sm" variant="accent" onClick={startEdit}>Edit Profile</Button> : null}
        </div>
      </header>

      {!member ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <User className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <h2 className="font-display text-2xl font-semibold">No Linked Team Record</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Add or update your record in the Team dashboard with the same staff email, then this page can edit the live public profile.
            </p>
            <Link
              href="/dashboard/team"
              className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Open Team Manager
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/5] bg-muted">
            {preview.profile_photo ? (
              <img src={preview.profile_photo} alt={preview.name} className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full items-center justify-center"><User className="h-16 w-16 text-muted-foreground/30" /></div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-5 text-white">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{preview.role || "Team Member"}</div>
              <h2 className="mt-1 font-display text-3xl font-semibold">{preview.name || "Team Member"}</h2>
            </div>
          </div>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={preview.status === "active" ? "success" : "warning"}>{preview.status || "draft"}</Badge>
              {preview.department ? <span className="text-xs text-muted-foreground">{preview.department}</span> : null}
            </div>
            {preview.tagline ? <p className="text-sm italic text-muted-foreground">"{preview.tagline}"</p> : null}
            <div className="space-y-2 text-sm">
              {preview.email ? <a href={`mailto:${preview.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-accent"><Mail className="h-3.5 w-3.5" />{preview.email}</a> : null}
              {preview.phone ? <a href={`tel:${preview.phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-2 text-muted-foreground hover:text-accent"><Phone className="h-3.5 w-3.5" />{preview.phone}</a> : null}
            </div>
            {preview.attributes?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {preview.attributes.map(attribute => <span key={attribute} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{attribute}</span>)}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            {!editing ? (
              <div className="space-y-6">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Public Bio</div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{member?.bio || "No bio has been added yet."}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoBlock icon={Image} label="Primary Photo" value={member?.profile_photo ? "Added" : "Missing"} />
                  <InfoBlock icon={Sparkles} label="Hover Photo" value={member?.secondary_photo ? "Added" : "Missing"} />
                </div>
                {member?.availability ? (
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Availability</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{member.availability}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-5">
                {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Name"><Input value={draft.name ?? ""} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></Field>
                  <Field label="Job Title"><Input value={draft.role ?? ""} onChange={event => setDraft(current => ({ ...current, role: event.target.value }))} /></Field>
                  <Field label="Department"><Input value={draft.department ?? ""} onChange={event => setDraft(current => ({ ...current, department: event.target.value }))} /></Field>
                  <Field label="Phone"><Input type="tel" value={draft.phone ?? ""} onChange={event => setDraft(current => ({ ...current, phone: event.target.value }))} /></Field>
                </div>
                <Field label="Email (managed by your account)"><Input type="email" value={draft.email ?? ""} disabled readOnly /></Field>
                <Field label="Tagline"><Input value={draft.tagline ?? ""} onChange={event => setDraft(current => ({ ...current, tagline: event.target.value }))} /></Field>
                <Field label="Bio"><Textarea rows={6} value={draft.bio ?? ""} onChange={event => setDraft(current => ({ ...current, bio: event.target.value }))} /></Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <PhotoField label="Profile photo (headshot)" value={draft.profile_photo ?? ""} onChange={v => setDraft(current => ({ ...current, profile_photo: v }))} />
                  <PhotoField label="Secondary / hover photo" value={draft.secondary_photo ?? ""} onChange={v => setDraft(current => ({ ...current, secondary_photo: v }))} hint="Shown on hover on your team card." />
                </div>
                <Field label="Availability"><Textarea rows={3} value={draft.availability ?? ""} onChange={event => setDraft(current => ({ ...current, availability: event.target.value }))} /></Field>
                <Field label="Key Attributes">
                  <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-card p-2">
                    {(draft.attributes ?? []).map(attribute => (
                      <span key={attribute} className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                        {attribute}
                        <button type="button" onClick={() => setDraft(current => ({ ...current, attributes: (current.attributes ?? []).filter(item => item !== attribute) }))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      className="min-w-[140px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Add attribute"
                      value={attrInput}
                      onChange={event => setAttrInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addAttr();
                        }
                      }}
                    />
                    <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-accent hover:bg-accent/10" onClick={addAttr} aria-label="Add attribute">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Field>
                <div className="flex justify-end gap-2 border-t border-border pt-5">
                  {member ? <Button variant="outline" onClick={cancelEdit} disabled={saving}>Cancel</Button> : null}
                  <Button variant="accent" onClick={() => void save()} disabled={saving || !member}>{saving ? "Saving..." : "Save Profile"}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function profileToDraft(member: TeamMember | null): Partial<TeamMemberDraft> {
  if (!member) return {};
  return {
    name: member.name,
    slug: member.slug,
    role: member.role ?? "",
    department: member.department ?? "",
    bio: member.bio ?? "",
    tagline: member.tagline ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
    profile_photo: member.profile_photo ?? "",
    secondary_photo: member.secondary_photo ?? "",
    attributes: member.attributes ?? [],
    availability: member.availability ?? "",
    sort_order: member.sort_order,
    status: member.status
  };
}

function fallbackPreview(): TeamMember {
  const now = new Date().toISOString();
  return {
    id: "preview",
    wp_post_id: null,
    name: "Team Member",
    slug: "team-member",
    role: "Constructed Matter",
    department: "Team",
    bio: null,
    tagline: null,
    email: null,
    phone: null,
    profile_photo: null,
    secondary_photo: null,
    attributes: [],
    availability: null,
    sort_order: 0,
    status: "inactive",
    created_at: now,
    updated_at: now
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
