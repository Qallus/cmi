"use client";

import * as React from "react";
import { Bell, CheckCircle2, Eye, Loader2, Mail, Plus, RotateCcw, Search, ShieldCheck, UserCog, UserPlus, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn, initials } from "@/lib/utils";
import type { ManagedUser, UserInput, UserRole, UsersData, UserStatus } from "@/lib/users/types";

type Draft = UserInput & { id?: string };

const roles: { value: UserRole; label: string; description: string }[] = [
  { value: "super_admin", label: "Super Admin", description: "Full dashboard and settings access." },
  { value: "admin", label: "Admin", description: "Operational admin access." },
  { value: "project_manager", label: "Project Manager", description: "Manages assigned projects and schedules." },
  { value: "staff", label: "Staff", description: "Internal project/task access." },
  { value: "designer", label: "Designer", description: "Design tasks, selections, and files." },
  { value: "estimator", label: "Estimator", description: "Leads, estimates, and scopes." },
  { value: "superintendent", label: "Superintendent", description: "Field schedule and punch items." },
  { value: "subcontractor", label: "Subcontractor", description: "Assigned work only." },
  { value: "vendor", label: "Vendor", description: "Procurement and delivery tasks." },
  { value: "client", label: "Client", description: "Client-visible project updates." },
  { value: "viewer", label: "Viewer", description: "Read-only permitted access." }
];

const statuses: UserStatus[] = ["active", "invited", "pending", "disabled", "suspended", "removed", "archived"];

const roleLabels = Object.fromEntries(roles.map(role => [role.value, role.label])) as Record<UserRole, string>;

const statusTone: Record<UserStatus, "default" | "accent" | "success" | "warning" | "danger" | "info"> = {
  active: "success",
  invited: "accent",
  pending: "warning",
  disabled: "danger",
  suspended: "danger",
  removed: "default",
  archived: "default"
};

function emptyDraft(role: UserRole = "client"): Draft {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role_slug: role,
    status: "pending",
    company_name: "",
    job_title: "",
    avatar_url: "",
    notes: "",
    send_invite: true,
    notify_sms: false
  };
}

function draftFromUser(user: ManagedUser): Draft {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone || "",
    role_slug: user.role_slug,
    status: user.status,
    company_name: user.company_name || "",
    job_title: user.job_title || user.title || "",
    avatar_url: user.avatar_url || "",
    notes: user.notes || "",
    send_invite: false,
    notify_sms: false
  };
}

export function UsersClient({ initialData, demoMode, setupMessage }: { initialData: UsersData; demoMode: boolean; setupMessage?: string }) {
  const [usersState, setUsersState] = React.useState(initialData.users);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<ManagedUser | null>(initialData.users[0] || null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(demoMode ? setupMessage || "Demo mode is using sample user data. Add Supabase credentials for live writes." : null);

  const filteredUsers = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return usersState.filter(user => {
      const matchesSearch = !term || [user.display_name, user.email, user.phone, user.company_name, user.job_title].some(value => String(value || "").toLowerCase().includes(term));
      const matchesRole = roleFilter === "all" || user.role_slug === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, usersState]);

  const metrics = React.useMemo(() => ({
    total: usersState.length,
    active: usersState.filter(user => user.status === "active").length,
    pending: usersState.filter(user => user.status === "pending" || user.status === "invited").length,
    disabled: usersState.filter(user => user.status === "disabled" || user.status === "suspended").length,
    staff: usersState.filter(user => ["super_admin", "admin", "project_manager", "staff", "designer", "estimator", "superintendent"].includes(user.role_slug)).length,
    clients: usersState.filter(user => user.role_slug === "client").length,
    subs: usersState.filter(user => user.role_slug === "subcontractor").length,
    vendors: usersState.filter(user => user.role_slug === "vendor").length
  }), [usersState]);

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    try {
      if (demoMode) {
        const demoUser = draftToManagedUser(draft);
        setUsersState(current => draft.id ? current.map(user => user.id === draft.id ? demoUser : user) : [demoUser, ...current]);
        setSelected(demoUser);
        setDraft(null);
        setNotice(draft.send_invite ? "Demo invite queued locally." : "Demo user saved locally.");
        return;
      }

      const res = await fetch(draft.id ? `/api/admin/users/${draft.id}` : "/api/admin/users", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed.");
      setUsersState(current => draft.id ? current.map(user => user.id === draft.id ? json.user : user) : [json.user, ...current]);
      setSelected(json.user);
      setDraft(null);
      setNotice(draft.send_invite ? "Invite queued." : "User saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user: ManagedUser, action: "disable" | "reactivate" | "resend") {
    setSaving(true);
    setNotice(null);
    try {
      if (demoMode) {
        const next = action === "disable" ? { ...user, status: "disabled" as UserStatus, disabled_at: new Date().toISOString() } : { ...user, status: "active" as UserStatus, disabled_at: null };
        setUsersState(current => current.map(row => row.id === user.id ? next : row));
        setSelected(next);
        setNotice(action === "resend" ? "Demo invite resent locally." : action === "disable" ? "Demo user disabled." : "Demo user reactivated.");
        return;
      }

      const url = action === "resend" ? `/api/admin/users/${user.id}/resend-invite` : `/api/admin/users/${user.id}`;
      const res = await fetch(url, {
        method: action === "resend" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: action === "resend" ? undefined : JSON.stringify({ action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Update failed.");
      setUsersState(current => current.map(row => row.id === user.id ? json.user : row));
      setSelected(json.user);
      setNotice(action === "resend" ? "Invite resent." : action === "disable" ? "User disabled." : "User reactivated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Administration</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Manage staff, clients, vendors, and subcontractors. User records can link to contacts now and are ready for project, task, punch list, email, and SMS workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDraft(emptyDraft("client"))}>
            <UserPlus className="h-4 w-4" />
            Invite User
          </Button>
          <Button variant="accent" onClick={() => setDraft({ ...emptyDraft("staff"), send_invite: false, status: "pending" })}>
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </header>

      {notice ? (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          ["Total Users", metrics.total],
          ["Active", metrics.active],
          ["Pending Invites", metrics.pending],
          ["Disabled", metrics.disabled],
          ["Staff", metrics.staff],
          ["Clients", metrics.clients],
          ["Subcontractors", metrics.subs],
          ["Vendors", metrics.vendors]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
              <div className="mt-3 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle>Managed Users</CardTitle>
                <CardDescription>Search, filter, invite, edit, disable, and reactivate access records.</CardDescription>
              </div>
              <div className="grid gap-2 md:grid-cols-[240px_160px_160px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users..." />
                </div>
                <Select value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
                  <option value="all">All roles</option>
                  {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                </Select>
                <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[1.5fr_1.3fr_110px_110px_1fr_130px] border-b border-border bg-muted/40 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <div>Name</div>
                <div>Email</div>
                <div>Role</div>
                <div>Status</div>
                <div>Company</div>
                <div>Actions</div>
              </div>
              {filteredUsers.length ? filteredUsers.map(user => (
                <button
                  key={user.id}
                  type="button"
                  className={cn("grid w-full grid-cols-[1.5fr_1.3fr_110px_110px_1fr_130px] items-center border-b border-border px-4 py-3 text-left text-sm transition hover:bg-muted/50", selected?.id === user.id && "bg-accent/8")}
                  onClick={() => setSelected(user)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar user={user} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{user.display_name}</div>
                      <div className="truncate text-xs text-muted-foreground">{user.job_title || "No job title"}</div>
                    </div>
                  </div>
                  <div className="truncate text-muted-foreground">{user.email}</div>
                  <div><Badge tone="info">{roleLabels[user.role_slug] || user.role_slug}</Badge></div>
                  <div><Badge tone={statusTone[user.status]}>{user.status}</Badge></div>
                  <div className="truncate text-muted-foreground">{user.company_name || "-"}</div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); setDraft(draftFromUser(user)); }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={event => { event.stopPropagation(); setSelected(user); }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </button>
              )) : (
                <div className="p-8 text-center text-sm text-muted-foreground">No users match those filters.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-accent" />
              User Detail
            </CardTitle>
            <CardDescription>Access status, contact link readiness, and future project visibility context.</CardDescription>
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <UserAvatar user={selected} size="lg" />
                  <div className="min-w-0">
                    <div className="font-display text-xl font-semibold">{selected.display_name}</div>
                    <div className="text-sm text-muted-foreground">{selected.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="info">{roleLabels[selected.role_slug] || selected.role_slug}</Badge>
                      <Badge tone={statusTone[selected.status]}>{selected.status}</Badge>
                      {selected.contact_id ? <Badge tone="success">Contact linked</Badge> : <Badge>Access only</Badge>}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 text-sm">
                  <Info label="Phone" value={selected.phone || "-"} />
                  <Info label="Company" value={selected.company_name || "-"} />
                  <Info label="Job Title" value={selected.job_title || selected.title || "-"} />
                  <Info label="Last Login" value={formatDate(selected.last_login_at)} />
                  <Info label="Invite Sent" value={formatDate(selected.invite_email_sent_at)} />
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <div className="mb-1 font-medium text-foreground">Project access foundation</div>
                  Clients will see client-visible milestones and updates. Vendors and subcontractors will later see assigned tasks, punch items, files, and notifications only.
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <div className="mb-1 font-medium text-foreground">Email and SMS</div>
                  Invites create an invite history record now. The email/SMS delivery layer can attach to Resend and Twilio when those integrations are migrated into this app.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setDraft(draftFromUser(selected))}>Edit User</Button>
                  <Button variant="outline" disabled={saving} onClick={() => updateUser(selected, "resend")}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Resend Invite
                  </Button>
                  {selected.status === "disabled" ? (
                    <Button variant="accent" disabled={saving} onClick={() => updateUser(selected, "reactivate")}>
                      <RotateCcw className="h-4 w-4" />
                      Reactivate
                    </Button>
                  ) : (
                    <Button variant="destructive" disabled={saving} onClick={() => updateUser(selected, "disable")}>
                      <XCircle className="h-4 w-4" />
                      Disable
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Select a user to view details.</div>
            )}
          </CardContent>
        </Card>
      </section>

      {draft ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4">
          <div className="ml-auto h-full w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
            <form onSubmit={saveDraft}>
              <div className="flex items-start justify-between border-b border-border p-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{draft.id ? "Edit User" : draft.send_invite ? "Invite User" : "Add User"}</div>
                  <h2 className="mt-2 font-display text-2xl font-semibold">{draft.id ? `Edit ${draft.first_name} ${draft.last_name}` : "Create User Access"}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Profiles can link to contacts for clients, vendors, and subcontractors, then connect to projects in the next phase.</p>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => setDraft(null)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="First Name *"><Input required value={draft.first_name} onChange={event => setDraft({ ...draft, first_name: event.target.value })} /></Field>
                <Field label="Last Name *"><Input required value={draft.last_name} onChange={event => setDraft({ ...draft, last_name: event.target.value })} /></Field>
                <Field label="Email *"><Input required type="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></Field>
                <Field label="Phone"><Input value={draft.phone || ""} onChange={event => setDraft({ ...draft, phone: event.target.value })} /></Field>
                <Field label="Role *">
                  <Select value={draft.role_slug} onChange={event => setDraft({ ...draft, role_slug: event.target.value as UserRole })}>
                    {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as UserStatus })}>
                    {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                  </Select>
                </Field>
                <Field label="Company / Organization"><Input value={draft.company_name || ""} onChange={event => setDraft({ ...draft, company_name: event.target.value })} /></Field>
                <Field label="Job Title"><Input value={draft.job_title || ""} onChange={event => setDraft({ ...draft, job_title: event.target.value })} /></Field>
                <Field label="Profile Photo URL" className="md:col-span-2">
                  <div className="grid gap-3 md:grid-cols-[72px_1fr] md:items-center">
                    <UserAvatar user={draftToManagedUser(draft)} size="lg" />
                    <Input value={draft.avatar_url || ""} onChange={event => setDraft({ ...draft, avatar_url: event.target.value })} placeholder="https://... or Supabase Storage public URL" />
                  </div>
                </Field>
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                  <input type="checkbox" checked={Boolean(draft.send_invite)} onChange={event => setDraft({ ...draft, send_invite: event.target.checked, status: event.target.checked ? "invited" : draft.status })} />
                  <Mail className="h-4 w-4 text-accent" />
                  Send invite email
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                  <input type="checkbox" checked={Boolean(draft.notify_sms)} onChange={event => setDraft({ ...draft, notify_sms: event.target.checked })} />
                  <Bell className="h-4 w-4 text-accent" />
                  Queue SMS notification
                </label>
                <Field label="Notes" className="md:col-span-2"><Textarea value={draft.notes || ""} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></Field>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-border p-5">
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {draft.id ? "Save User" : draft.send_invite ? "Create & Invite" : "Create User"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserAvatar({ user, size = "sm" }: { user: Pick<ManagedUser, "display_name" | "avatar_url">; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "h-12 w-12 text-sm" : "h-8 w-8 text-xs";
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name}
        className={cn(sizeClass, "shrink-0 rounded-full border border-border object-cover")}
      />
    );
  }
  return <div className={cn(sizeClass, "grid shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground")}>{initials(user.display_name)}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block text-sm font-medium", className)}>
      <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function draftToManagedUser(draft: Draft): ManagedUser {
  const now = new Date().toISOString();
  return {
    id: draft.id || crypto.randomUUID(),
    auth_user_id: null,
    contact_id: ["client", "vendor", "subcontractor"].includes(draft.role_slug) ? crypto.randomUUID() : null,
    email: draft.email,
    first_name: draft.first_name,
    last_name: draft.last_name,
    display_name: `${draft.first_name} ${draft.last_name}`.trim() || draft.email,
    phone: draft.phone || null,
    role_slug: draft.role_slug,
    status: draft.send_invite ? "invited" : draft.status,
    company_name: draft.company_name || null,
    job_title: draft.job_title || null,
    title: draft.job_title || null,
    avatar_url: draft.avatar_url || null,
    notes: draft.notes || null,
    invited_at: draft.send_invite ? now : null,
    invite_email_sent_at: draft.send_invite ? now : null,
    invite_sms_sent_at: draft.notify_sms ? now : null,
    invite_accepted_at: null,
    disabled_at: draft.status === "disabled" ? now : null,
    last_login_at: null,
    created_at: now,
    updated_at: now
  };
}
