"use client";

// Bookings → Events: build an invitation page, manage guests, track RSVPs.
// Left: the editor tabs. Right: a live preview using the same component as the
// public page.
import * as React from "react";
import {
  ArrowLeft, Check, Copy, Download, ExternalLink, Loader2, Mic, Monitor, Plus, Smartphone, Sparkles, Trash2, Upload, UserPlus, Users, X,
} from "lucide-react";
import { AudioRecorder } from "@/components/audio/audio-recorder";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { SearchableMultiSelect } from "@/components/ui/searchable-select";
import { InvitationPage } from "@/components/events/invitation-page";
import { EVENT_THEMES } from "@/lib/events/themes";
import { publicGuestList, rsvpCounts, type EventDesign, type GoodToKnowRow } from "@/lib/events/design";
import { formatWhen } from "@/lib/events/format";
import type { EventRsvp, EventSummary, InvitationEvent } from "@/lib/events/types";

type StaffOption = { id: string; name: string; email: string | null };
type Rsvp = EventRsvp & { link: string };
type Detail = { event: InvitationEvent; rsvps: Rsvp[]; url: string };
type Tab = "design" | "details" | "guests" | "responses";

// Arizona is UTC-7 all year, so datetime-local inputs convert without a library.
const AZ_MS = 7 * 3600_000;
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() - AZ_MS).toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(`${v}:00-07:00`).toISOString() : null;
}
function toDateInput(iso: string | null | undefined): string {
  return toLocalInput(iso).slice(0, 10);
}
function fromDateInput(v: string): string | null {
  return v ? new Date(`${v}T12:00:00-07:00`).toISOString() : null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? j.message ?? `Request failed (${res.status})`);
  return j as T;
}

const STATUS_LABEL: Record<string, string> = { draft: "Draft", published: "Live", private: "Live (unlisted)", archived: "Archived", canceled: "Canceled" };

function StatusPill({ status }: { status: string }) {
  const live = status === "published" || status === "private";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${live ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function EventsClient({ initialEvents, staff, initialEventId }: { initialEvents: EventSummary[]; staff: StaffOption[]; initialEventId: string | null }) {
  const [events, setEvents] = React.useState(initialEvents);
  const [openId, setOpenId] = React.useState<string | null>(initialEventId);
  const [creating, setCreating] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newStart, setNewStart] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [describe, setDescribe] = React.useState("");
  const [recording, setRecording] = React.useState(false);
  const [aiBusy, setAiBusy] = React.useState<null | "transcribe" | "draft">(null);

  async function transcribe(blob: Blob) {
    setRecording(false);
    setAiBusy("transcribe");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "event.webm", { type: blob.type || "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Transcription failed.");
      setDescribe((d) => (d ? `${d}
${j.transcript}` : j.transcript));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiBusy(null);
    }
  }

  // Describe it → Bolt drafts the fields → create the event → open the editor.
  async function draftAndCreate() {
    setError(null);
    setAiBusy("draft");
    try {
      const { draft } = await api<{ draft: Record<string, unknown> & { title: string; start_time: string | null } }>("/api/events/draft", {
        method: "POST",
        body: JSON.stringify({ description: describe }),
      });
      const start = draft.start_time ?? fromLocalInput(newStart);
      if (!start) {
        setNewTitle(draft.title || newTitle);
        throw new Error("Bolt couldn't tell when it is. Add the start date and time, then try again.");
      }
      const body: Record<string, unknown> = { ...draft, title: draft.title || newTitle || "New event", start_time: start };
      if (!body.end_time) delete body.end_time;
      const j = await api<{ event: InvitationEvent }>("/api/events", { method: "POST", body: JSON.stringify(body) });
      setCreating(false); setDescribe(""); setNewTitle(""); setNewStart("");
      await refreshList();
      setOpenId(j.event.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiBusy(null);
    }
  }

  async function refreshList() {
    const j = await api<{ events: EventSummary[] }>("/api/events");
    setEvents(j.events);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const j = await api<{ event: InvitationEvent }>("/api/events", {
        method: "POST",
        body: JSON.stringify({ title: newTitle, start_time: fromLocalInput(newStart) }),
      });
      setCreating(false); setNewTitle(""); setNewStart("");
      await refreshList();
      setOpenId(j.event.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (openId) {
    return <EventEditor id={openId} staff={staff} onClose={() => { setOpenId(null); refreshList().catch(() => {}); }} />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">Invitation pages with RSVPs, +1s and a guest list. Build them here or ask Claude.</p>
        </div>
        <Button variant="accent" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New invitation</Button>
      </div>

      {creating ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <Field label="Describe it" hint="Type or dictate what, when, where, who and anything guests should know. Bolt drafts the page; you review it before publishing.">
            <Textarea rows={4} value={describe} onChange={(e) => setDescribe(e.target.value)} placeholder="Christmas dinner and drinks for the team on Friday Dec 18, 6 to 9 PM at Rokerij's private dining room, 6335 N 16th St Phoenix. Bring a +1. RSVP by Dec 4. Rideshare encouraged and expensable. From Brandon and Joe." />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!!aiBusy} onClick={() => setRecording(true)}>
              {aiBusy === "transcribe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Dictate
            </Button>
            <Button type="button" variant="accent" disabled={!!aiBusy || describe.trim().length < 5} onClick={draftAndCreate}>
              {aiBusy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Draft with Bolt
            </Button>
          </div>
          <AudioRecorder open={recording} onClose={() => setRecording(false)} onComplete={(blob) => void transcribe(blob)} />
          <p className="text-xs text-muted-foreground">Or start from scratch:</p>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
          <Field label="Event title">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Christmas Dinner & Drinks 2026" autoFocus />
          </Field>
          <Field label="Starts">
            <Input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="accent" disabled={busy || !newTitle.trim() || !newStart}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}

      {events.length === 0 && !creating ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No invitations yet. Create one, or ask Claude: &ldquo;Make an invite for our holiday dinner on Dec 18 at 6 PM.&rdquo;
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {events.map((ev) => (
            <button key={ev.id} type="button" onClick={() => setOpenId(ev.id)} className="rounded-lg border border-border bg-card p-4 text-left transition hover:border-foreground/30">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium leading-snug">{ev.title}</h2>
                <StatusPill status={ev.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{formatWhen(ev.start_time, ev.end_time)}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{ev.counts.headcount}</strong> coming</span>
                <span>{ev.counts.declined} declined</span>
                <span>{ev.counts.waiting} waiting</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editor ─────────────────────────────────────────────────────────────────

function EventEditor({ id, staff, onClose }: { id: string; staff: StaffOption[]; onClose: () => void }) {
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [draft, setDraft] = React.useState<InvitationEvent | null>(null);
  const [tab, setTab] = React.useState<Tab>("design");
  const [device, setDevice] = React.useState<"desktop" | "phone">("desktop");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const j = await api<Detail>(`/api/events/${id}`);
    setDetail(j);
    setDraft((d) => (d && d.id === j.event.id ? d : j.event));
    return j;
  }, [id]);

  React.useEffect(() => { load().catch((e) => setError((e as Error).message)); }, [load]);

  if (!detail || !draft) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>}
      </div>
    );
  }

  const saved = detail.event;
  const dirty = JSON.stringify(pickEditable(draft)) !== JSON.stringify(pickEditable(saved));
  const live = saved.status === "published" || saved.status === "private";

  const setDesign = (patch: Partial<EventDesign>) => setDraft({ ...draft, design: { ...draft.design, ...patch } });

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    setError(null);
    try {
      const j = await api<{ event: InvitationEvent; url: string }>(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...pickEditable(draft!), ...extra }),
      });
      setDraft(j.event);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!window.confirm("Archive this event? The page stops working; responses are kept.")) return;
    await api(`/api/events/${id}`, { method: "DELETE" });
    onClose();
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); });
  }

  const previewGuests = publicGuestList(detail.rsvps, draft.design.guest_list);

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4" /> Events</Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{saved.title}</h1>
        <StatusPill status={saved.status} />
        <Button variant="outline" size="sm" onClick={() => copy(detail.url, "page")}>
          {copied === "page" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Link
        </Button>
        {live ? (
          <a href={detail.url} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> Open</Button></a>
        ) : null}
        <a href={`/api/events/${id}/export`} title="Download the page as one HTML file to host anywhere. RSVPs still come back here."><Button variant="outline" size="sm"><Download className="h-4 w-4" /> HTML</Button></a>
        {live ? (
          <Button variant="outline" size="sm" disabled={saving} onClick={() => save({ status: "draft" })}>Unpublish</Button>
        ) : (
          <Button variant="outline" size="sm" disabled={saving} onClick={() => save({ status: "published" })}>Publish</Button>
        )}
        <Button variant="accent" size="sm" disabled={!dirty || saving} onClick={() => save()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {dirty ? "Save" : "Saved"}
        </Button>
        <Button variant="ghost" size="icon" title="Archive" onClick={archive}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {error ? <p className="px-4 pt-3 text-sm text-destructive md:px-6">{error}</p> : null}

      <div className="grid flex-1 gap-0 lg:grid-cols-[minmax(360px,460px)_1fr]">
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex gap-1 border-b border-border px-3 pt-3">
            {(["design", "details", "guests", "responses"] as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-t-md px-3 py-2 text-sm capitalize ${tab === t ? "border border-b-0 border-border bg-card font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "responses" ? `Responses (${rsvpCounts(detail.rsvps).headcount})` : t}
              </button>
            ))}
          </div>
          <div className="space-y-5 p-4 md:p-5">
            {tab === "design" ? (
              <DesignTab
                draft={draft}
                setDesign={setDesign}
                setMode={(m) => setDraft({ ...draft, design_mode: m })}
                setCustomHtml={(h) => setDraft({ ...draft, custom_html: h })}
              />
            ) : null}
            {tab === "details" ? <DetailsTab draft={draft} setDraft={setDraft} /> : null}
            {tab === "guests" ? <GuestsTab eventId={id} detail={detail} staff={staff} reload={load} copy={copy} copied={copied} /> : null}
            {tab === "responses" ? <ResponsesTab detail={detail} /> : null}
          </div>
        </div>

        <div className="bg-muted/40">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>Preview{dirty ? " (unsaved changes)" : ""}</span>
            <div className="flex gap-1">
              <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon" title="Desktop" onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></Button>
              <Button variant={device === "phone" ? "secondary" : "ghost"} size="icon" title="Phone" onClick={() => setDevice("phone")}><Smartphone className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="px-4 pb-6">
            <div className={`mx-auto max-h-[calc(100vh-180px)] overflow-y-auto rounded-md border border-border shadow-sm ${device === "phone" ? "max-w-[390px]" : "max-w-full"}`}>
              <InvitationPage key={`${draft.design.theme}-${device}`} event={draft} guests={previewGuests} rsvp={null} preview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pickEditable(e: InvitationEvent) {
  return {
    title: e.title,
    summary: e.summary,
    start_time: e.start_time,
    end_time: e.end_time,
    location: e.location,
    access: e.access,
    allow_plus_one: e.allow_plus_one,
    rsvp_deadline: e.rsvp_deadline,
    design: e.design,
    design_mode: e.design_mode,
    custom_html: e.custom_html,
  };
}

// ── Design tab ─────────────────────────────────────────────────────────────

function DesignTab({ draft, setDesign, setMode, setCustomHtml }: {
  draft: InvitationEvent; setDesign: (p: Partial<EventDesign>) => void; setMode: (m: "theme" | "custom") => void; setCustomHtml: (h: string) => void;
}) {
  const d = draft.design;
  const [uploading, setUploading] = React.useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "events");
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok && j.url) setDesign({ image_url: j.url });
    } finally {
      setUploading(false);
    }
  }

  const rows = d.good_to_know;
  const setRow = (i: number, patch: Partial<GoodToKnowRow>) => setDesign({ good_to_know: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-medium">Page design</p>
        <div className="flex gap-2">
          <Button size="sm" variant={draft.design_mode === "custom" ? "outline" : "secondary"} onClick={() => setMode("theme")}>Theme</Button>
          <Button size="sm" variant={draft.design_mode === "custom" ? "secondary" : "outline"} onClick={() => setMode("custom")}>Custom HTML</Button>
        </div>
        {draft.design_mode === "custom" ? (
          <>
            <Textarea rows={10} className="font-mono text-xs" value={draft.custom_html ?? ""} onChange={(e) => setCustomHtml(e.target.value)} placeholder="Paste the invitation HTML from Claude…" />
            <p className="text-xs text-muted-foreground">
              Paste a design from Claude (hero, message, animation). It runs in a locked-down frame, so it can&apos;t reach CMI. CMI adds the RSVP card, Good to know and Who&apos;s coming below it, so leave any RSVP form out of the HTML. 500 KB max.
            </p>
          </>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Theme</p>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDesign({ theme: t.id })}
              className={`overflow-hidden rounded-md border text-left transition ${d.theme === t.id ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/40"}`}
            >
              <div className="h-12" style={{ background: t.heroBg }}>
                <div className="flex h-full items-end gap-1 p-2">
                  {t.stripe.map((c, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: c }} />)}
                </div>
              </div>
              <div className="p-2">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Field label="Eyebrow" hint="The small line above the title.">
        <Input value={d.eyebrow} onChange={(e) => setDesign({ eyebrow: e.target.value })} />
      </Field>
      <Field label="Accent words in the title" hint={`Shown in the theme colour, e.g. “2026”.`}>
        <Input value={d.title_accent} onChange={(e) => setDesign({ title_accent: e.target.value })} />
      </Field>
      <Field label="Message heading">
        <Input value={d.message_heading} onChange={(e) => setDesign({ message_heading: e.target.value })} placeholder="Here's to the people who build Constructed Matter" />
      </Field>
      <Field label="Message">
        <Textarea rows={4} value={d.message_body} onChange={(e) => setDesign({ message_body: e.target.value })} />
      </Field>
      <Field label="Sign-off" hint="One line per row, e.g. “Merry Christmas,” then the names.">
        <Textarea rows={2} value={d.signoff} onChange={(e) => setDesign({ signoff: e.target.value })} />
      </Field>
      <Field label="Photo (optional)">
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
          {d.image_url ? <Button variant="ghost" size="sm" onClick={() => setDesign({ image_url: "" })}><X className="h-4 w-4" /> Remove</Button> : null}
        </div>
      </Field>
      <Field label="Note above the RSVP buttons (optional)" hint="E.g. how to RSVP by text instead. Emails and phone numbers become links.">
        <Textarea rows={2} value={d.rsvp_note} onChange={(e) => setDesign({ rsvp_note: e.target.value })} />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium">Good to know</p>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-2">
            <Input value={r.label} placeholder="Label" onChange={(e) => setRow(i, { label: e.target.value })} />
            <div className="space-y-1">
              <Input value={r.value} placeholder="Text" onChange={(e) => setRow(i, { value: e.target.value })} />
              <Input value={r.url ?? ""} placeholder="Link (optional)" onChange={(e) => setRow(i, { url: e.target.value })} />
            </div>
            <Button variant="ghost" size="icon" title="Remove row" onClick={() => setDesign({ good_to_know: rows.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setDesign({ good_to_know: [...rows, { label: "", value: "" }] })}><Plus className="h-4 w-4" /> Add row</Button>
      </div>

      <Field label="Who's coming list">
        <Select value={d.guest_list} onChange={(e) => setDesign({ guest_list: e.target.value as EventDesign["guest_list"] })}>
          <option value="full">Full names</option>
          <option value="first">First names only</option>
          <option value="count">Just the count</option>
          <option value="off">Hide it</option>
        </Select>
      </Field>
      <Toggle checked={d.dietary} onChange={(v) => setDesign({ dietary: v })} label="Ask for dietary needs or notes" />
      <Field label="Footer line">
        <Input value={d.footer_note} onChange={(e) => setDesign({ footer_note: e.target.value })} placeholder="Thank you for an incredible 2026." />
      </Field>
    </>
  );
}

// ── Details tab ────────────────────────────────────────────────────────────

function DetailsTab({ draft, setDraft }: { draft: InvitationEvent; setDraft: (e: InvitationEvent) => void }) {
  const set = (patch: Partial<InvitationEvent>) => setDraft({ ...draft, ...patch });
  return (
    <>
      <Field label="Title">
        <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts (Arizona time)">
          <Input type="datetime-local" value={toLocalInput(draft.start_time)} onChange={(e) => set({ start_time: fromLocalInput(e.target.value) ?? draft.start_time })} />
        </Field>
        <Field label="Ends">
          <Input type="datetime-local" value={toLocalInput(draft.end_time)} onChange={(e) => set({ end_time: fromLocalInput(e.target.value) ?? draft.end_time })} />
        </Field>
      </div>
      <Field label="Where" hint="Venue on the first line, address on the next. The address links to Google Maps.">
        <Textarea rows={3} value={draft.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder={"Rokerij Private Dining Room\n6335 N 16th St, Phoenix, AZ 85016"} />
      </Field>
      <Field label="RSVP by" hint="Optional. RSVPs stay open through the end of that day.">
        <Input type="date" value={toDateInput(draft.rsvp_deadline)} onChange={(e) => set({ rsvp_deadline: fromDateInput(e.target.value) })} />
      </Field>
      <Toggle checked={draft.allow_plus_one} onChange={(v) => set({ allow_plus_one: v })} label="Guests may bring a +1" />
      <Field label="Who can RSVP">
        <Select value={draft.access} onChange={(e) => set({ access: e.target.value as InvitationEvent["access"] })}>
          <option value="invite_only">Invited guests only (personal links)</option>
          <option value="link">Anyone with the link</option>
        </Select>
      </Field>
      <Field label="Short summary (optional)" hint="Used when the link is shared in a text or chat.">
        <Input value={draft.summary ?? ""} onChange={(e) => set({ summary: e.target.value })} />
      </Field>
    </>
  );
}

// ── Guests tab ─────────────────────────────────────────────────────────────

function GuestsTab({ eventId, detail, staff, reload, copy, copied }: {
  eventId: string; detail: Detail; staff: StaffOption[]; reload: () => Promise<unknown>; copy: (t: string, k: string) => void; copied: string | null;
}) {
  const [pickStaff, setPickStaff] = React.useState<string[]>([]);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; name: string; email: string | null; detail: string }[]>([]);
  const [person, setPerson] = React.useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api<{ contacts: typeof results }>(`/api/events/contacts?q=${encodeURIComponent(q.trim())}`).then((j) => setResults(j.contacts)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function add(body: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    try {
      const j = await api<{ added: number; skipped: number }>(`/api/events/${eventId}/guests`, { method: "POST", body: JSON.stringify(body) });
      setNote(`Added ${j.added}${j.skipped ? `, ${j.skipped} already on the list` : ""}.`);
      await reload();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(rsvpId: string, fields: Record<string, unknown>) {
    try {
      await api(`/api/events/${eventId}/guests`, { method: "PATCH", body: JSON.stringify({ rsvpId, ...fields }) });
      await reload();
    } catch (e) {
      setNote((e as Error).message);
    }
  }

  async function remove(rsvpId: string, name: string) {
    if (!window.confirm(`Remove ${name} from the guest list?`)) return;
    await api(`/api/events/${eventId}/guests?rsvpId=${rsvpId}`, { method: "DELETE" });
    await reload();
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-medium">Staff</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => add({ allStaff: true })}><Users className="h-4 w-4" /> Invite all staff</Button>
        </div>
        <SearchableMultiSelect options={staff.map((s) => ({ value: s.id, label: s.name, sublabel: s.email ?? undefined }))} values={pickStaff} onChange={setPickStaff} placeholder="Pick staff…" />
        {pickStaff.length ? (
          <Button size="sm" variant="accent" disabled={busy} onClick={() => add({ staffIds: pickStaff }).then(() => setPickStaff([]))}>
            <UserPlus className="h-4 w-4" /> Add {pickStaff.length}
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Contacts and clients</p>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts by name, email or company" />
        {results.length ? (
          <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {results.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[c.email, c.detail].filter(Boolean).join(" · ")}</span>
                </span>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => add({ contactIds: [c.id] })}>Add</Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Someone else</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} placeholder="Name" />
          <Input value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} placeholder="Email" />
          <Input value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} placeholder="Phone" />
        </div>
        <Button size="sm" variant="outline" disabled={busy || (!person.name.trim() && !person.email.trim())} onClick={() => add({ people: [person] }).then(() => setPerson({ name: "", email: "", phone: "" }))}>
          <Plus className="h-4 w-4" /> Add guest
        </Button>
      </div>

      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}

      <SendPanel eventId={eventId} live={detail.event.status === "published" || detail.event.status === "private"} reload={reload} />

      <div className="space-y-2">
        <p className="text-sm font-medium">Guest list ({detail.rsvps.length})</p>
        <p className="text-xs text-muted-foreground">Each guest has a personal RSVP link. Change a status here to record an RSVP someone sent by text or email.</p>
        <ul className="divide-y divide-border rounded-md border border-border">
          {detail.rsvps.map((r) => (
            <li key={r.id} className="space-y-2 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}{r.plus_one ? <span className="ml-1 text-muted-foreground">+1{r.plus_one_name ? ` (${r.plus_one_name})` : ""}</span> : null}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[r.email, r.source === "link" ? "via open link" : null, r.opened_at ? "opened" : null].filter(Boolean).join(" · ")}</span>
                </span>
                <Button variant="ghost" size="icon" title="Copy personal link" onClick={() => copy(r.link, r.id)}>{copied === r.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                <Button variant="ghost" size="icon" title="Remove" onClick={() => remove(r.id, r.name)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-40">
                  <Select value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })}>
                    <option value="invited">Waiting</option>
                    <option value="attending">Attending</option>
                    <option value="declined">Can&apos;t make it</option>
                  </Select>
                </div>
                {r.status === "attending" && detail.event.allow_plus_one ? (
                  <Toggle checked={r.plus_one} onChange={(v) => patch(r.id, { plus_one: v })} label="+1" />
                ) : null}
              </div>
              {r.notes ? <p className="text-xs text-muted-foreground">Note: {r.notes}</p> : null}
            </li>
          ))}
          {detail.rsvps.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">No guests yet.</li> : null}
        </ul>
      </div>
    </>
  );
}

// ── Responses tab ──────────────────────────────────────────────────────────

function ResponsesTab({ detail }: { detail: Detail }) {
  const c = rsvpCounts(detail.rsvps);
  const attending = detail.rsvps.filter((r) => r.status === "attending");
  const notes = attending.filter((r) => r.notes);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Name", "Email", "Phone", "Status", "+1", "+1 name", "Notes", "Responded"];
    const lines = detail.rsvps.map((r) => [r.name, r.email, r.phone, r.status, r.plus_one ? "yes" : "", r.plus_one_name, r.notes, r.responded_at].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${detail.event.slug}-rsvps.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const stat = (label: string, value: number) => (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Headcount", c.headcount)}
        {stat("Attending", c.attending)}
        {stat("Declined", c.declined)}
        {stat("Waiting", c.waiting)}
      </div>
      <p className="text-xs text-muted-foreground">Headcount counts {c.plusOnes} +1{c.plusOnes === 1 ? "" : "s"}. {c.invited} on the list in total.</p>
      <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>

      <div className="space-y-2">
        <p className="text-sm font-medium">For the restaurant</p>
        {notes.length ? (
          <ul className="space-y-1 text-sm">
            {notes.map((r) => <li key={r.id}><strong className="font-medium">{r.name}:</strong> {r.notes}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No dietary needs or notes yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Attending ({attending.length})</p>
        <ul className="text-sm">
          {attending.map((r) => <li key={r.id}>{r.name}{r.plus_one ? ` +1${r.plus_one_name ? ` (${r.plus_one_name})` : ""}` : ""}</li>)}
        </ul>
      </div>
    </>
  );
}

// ── Sending ────────────────────────────────────────────────────────────────

type Plan = { channel: string; recipients: { id: string; name: string; to: string }[]; skipped: { name: string; reason: string }[]; held: boolean };

function SendPanel({ eventId, live, reload }: { eventId: string; live: boolean; reload: () => Promise<unknown> }) {
  const [channel, setChannel] = React.useState<"email" | "sms">("email");
  const [scope, setScope] = React.useState<"unsent" | "waiting">("unsent");
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function review() {
    setBusy(true); setMsg(null);
    try {
      const j = await api<{ plan: Plan }>(`/api/events/${eventId}/send`, { method: "POST", body: JSON.stringify({ channel, scope, dryRun: true }) });
      setPlan(j.plan);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  async function send() {
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ sent: number; held: number; failed: { name: string; reason: string }[] }>(`/api/events/${eventId}/send`, { method: "POST", body: JSON.stringify({ channel, scope, dryRun: false }) });
      setPlan(null);
      setMsg([
        `Sent ${r.sent}.`,
        r.held ? `${r.held} held (outbound sending is off outside production).` : "",
        r.failed.length ? `Failed: ${r.failed.map((f) => `${f.name} (${f.reason})`).join(", ")}.` : "",
      ].filter(Boolean).join(" "));
      await reload();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ ok: boolean; held: boolean }>(`/api/events/${eventId}/send`, { method: "POST", body: JSON.stringify({ test: true }) });
      setMsg(r.ok ? "Test sent to your email." : r.held ? "Test held: outbound sending is off outside production." : "The test didn't send. Check the email settings.");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Send invitations</p>
      <p className="text-xs text-muted-foreground">Each guest gets their own RSVP link. Opted-out contacts are skipped. {live ? "" : "Publish the event first so the links work."}</p>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/events/${eventId}/send`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> Preview email</Button></a>
        <Button variant="outline" size="sm" disabled={busy} onClick={test}>Send me a test</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={channel} onChange={(e) => { setChannel(e.target.value as "email" | "sms"); setPlan(null); }}>
          <option value="email">Email</option>
          <option value="sms">Text message</option>
        </Select>
        <Select value={scope} onChange={(e) => { setScope(e.target.value as "unsent" | "waiting"); setPlan(null); }}>
          <option value="unsent">Guests not sent yet</option>
          <option value="waiting">Everyone still waiting (reminder)</option>
        </Select>
      </div>
      {!plan ? (
        <Button size="sm" variant="accent" disabled={busy || !live} onClick={review}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Review recipients</Button>
      ) : (
        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
          <p><strong>{plan.recipients.length}</strong> will get {channel === "email" ? "an email" : "a text"}{plan.recipients.length ? `: ${plan.recipients.map((r) => r.name).join(", ")}` : "."}</p>
          {plan.skipped.length ? <p className="text-muted-foreground">Skipped: {plan.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}</p> : null}
          {plan.held ? <p className="text-xs text-muted-foreground">Outbound sending is off here (not production), so these will be held, not sent.</p> : null}
          <div className="flex gap-2">
            <Button size="sm" variant="accent" disabled={busy || !plan.recipients.length} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send {plan.recipients.length}</Button>
            <Button size="sm" variant="ghost" onClick={() => setPlan(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
