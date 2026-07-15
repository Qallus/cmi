"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock, Contact, FolderKanban, Loader2, MoreHorizontal, Plus, Search, Trash2, Upload, UserPlus, UserRound, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn, initials } from "@/lib/utils";
import type { AppointmentStatus, AppointmentType, BookingAppointment, BookingData, BookingEventPage, BookingInput, BookingSlot } from "@/lib/booking/types";

type Draft = Partial<BookingInput>;
type EventDraft = {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  appointment_type_id: string;
  event_type: string;
  host_staff_user_id: string;
  project_id: string;
  start_time: string;
  end_time: string;
  location_type: string;
  location: string;
  capacity: string;
  status: "draft" | "published" | "private";
  show_on_project_manager: boolean;
  photo_url: string;
  video_url: string;
  gallery_urls: string[];
  show_spots_remaining: boolean;
  multi_day: boolean;
};

// datetime-local ("YYYY-MM-DDTHH:mm") helpers for the single-date event editor.
function datePartOf(dt: string) { return dt ? dt.slice(0, 10) : ""; }
function timePartOf(dt: string) { return dt && dt.length >= 16 ? dt.slice(11, 16) : ""; }
function joinDateTime(date: string, time: string) { return date ? `${date}T${time || "00:00"}` : ""; }
type ViewMode = "list" | "calendar" | "events" | "availability";

// Curated event-page categories for the "Event Type" select. Unlike appointment
// types (which drive scheduling/availability), these describe the kind of one-time
// event and are stored on the event page's metadata.
const EVENT_TYPES = [
  "Open House",
  "Workshop",
  "Webinar",
  "Community Event",
  "Grand Opening",
  "Groundbreaking",
  "Networking Event",
  "Seminar",
  "Client Appreciation",
  "Other",
];

// Upload a file to the shared media bucket and return its public URL.
async function uploadToMedia(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || "Upload failed.");
  return String(json.url);
}

const statuses: AppointmentStatus[] = ["pending", "confirmed", "rescheduled", "completed", "canceled", "no_show", "follow_up_needed", "awaiting_client", "awaiting_staff", "awaiting_project_info"];

const statusTone: Record<AppointmentStatus, "default" | "accent" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  confirmed: "info",
  rescheduled: "accent",
  completed: "success",
  canceled: "danger",
  no_show: "danger",
  follow_up_needed: "warning",
  awaiting_client: "warning",
  awaiting_staff: "warning",
  awaiting_project_info: "warning"
};

function AppointmentLinksFab({ appointment, onDelete }: { appointment: BookingAppointment; onDelete: (appointment: BookingAppointment) => void }) {
  const [open, setOpen] = React.useState(false);
  const [btnRect, setBtnRect] = React.useState<DOMRect | null>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const contactHref = appointment.contact_id
    ? `/dashboard/contacts?id=${encodeURIComponent(appointment.contact_id)}`
    : appointment.customer_email
      ? `/dashboard/contacts?search=${encodeURIComponent(appointment.customer_email)}`
      : "/dashboard/contacts";
  const userHref = appointment.staff_user_id
    ? `/dashboard/users?id=${encodeURIComponent(appointment.staff_user_id)}`
    : appointment.customer_email
      ? `/dashboard/users?search=${encodeURIComponent(appointment.customer_email)}`
      : "/dashboard/users";
  const ganttHref = appointment.project_schedule_item_id
    ? `/dashboard/project-manager?schedule_item=${encodeURIComponent(appointment.project_schedule_item_id)}`
    : appointment.project_id
      ? `/dashboard/project-manager?project=${encodeURIComponent(appointment.project_id)}`
      : appointment.project_name
        ? `/dashboard/project-manager?search=${encodeURIComponent(appointment.project_name)}`
        : "/dashboard/project-manager";

  const actions = [
    { label: "Contact", href: contactHref, icon: Contact, available: Boolean(appointment.contact_id || appointment.customer_email) },
    { label: "User", href: userHref, icon: UserRound, available: Boolean(appointment.staff_user_id || appointment.customer_email) },
    { label: "Gantt", href: ganttHref, icon: FolderKanban, available: Boolean(appointment.project_schedule_item_id || appointment.project_id || appointment.project_name || appointment.show_on_project_manager) }
  ];

  const MENU_WIDTH = 176;

  // Open by capturing the button's viewport rect. The exact position is computed
  // in the layout effect below, once the (portaled) menu has rendered and its
  // real height is known — so top rows drop down, bottom rows flip up, and the
  // menu is never clipped by the card's overflow or the viewport edges.
  function toggle() {
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBtnRect(rect);
    setCoords(null);
    setOpen(true);
  }

  React.useLayoutEffect(() => {
    if (!open || !btnRect || !menuRef.current) return;
    const gap = 6;
    const h = menuRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const dropUp = spaceBelow < h + gap + 8 && btnRect.top > spaceBelow;
    const rawTop = dropUp ? btnRect.top - h - gap : btnRect.bottom + gap;
    setCoords({
      top: Math.min(Math.max(8, rawTop), Math.max(8, window.innerHeight - h - 8)),
      left: Math.min(Math.max(8, btnRect.right - MENU_WIDTH), Math.max(8, window.innerWidth - MENU_WIDTH - 8)),
    });
  }, [open, btnRect]);

  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  return (
    <div className="flex justify-end" onClick={event => event.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-accent hover:text-accent",
          open && "border-accent bg-accent text-accent-foreground hover:text-accent-foreground"
        )}
        aria-label="Open booking actions"
        aria-expanded={open}
        onClick={toggle}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && btnRect && typeof document !== "undefined" && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: coords?.top ?? btnRect.bottom + 6, left: coords?.left ?? Math.max(8, btnRect.right - MENU_WIDTH), width: MENU_WIDTH, visibility: coords ? "visible" : "hidden" }} className="z-[200] rounded-xl border border-border bg-card p-1.5 shadow-xl" onClick={e => e.stopPropagation()}>
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-muted", !action.available && "text-muted-foreground")} onClick={() => setOpen(false)}>
                <Icon className="h-4 w-4 text-accent" /><span>{action.label}</span>
              </Link>
            );
          })}
          <div className="my-1 border-t border-border" />
          <button type="button" onClick={() => { setOpen(false); onDelete(appointment); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" /><span>Delete</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(types: AppointmentType[]): Draft {
  return {
    appointment_type_id: types[0]?.id || "",
    start_time: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    project_name: "",
    project_id: "",
    assigned_staff_user_id: "",
    notes: "",
    email_consent: true,
    sms_consent: false,
    create_or_link_user: true,
    show_on_project_manager: true
  };
}

function emptyEventDraft(types: AppointmentType[]): EventDraft {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    slug: "",
    summary: "",
    description: "",
    appointment_type_id: types[0]?.id || "",
    event_type: EVENT_TYPES[0],
    host_staff_user_id: "",
    project_id: "",
    start_time: toDateTimeLocal(start),
    end_time: toDateTimeLocal(end),
    location_type: "in_person",
    location: "",
    capacity: "",
    status: "draft",
    show_on_project_manager: true,
    photo_url: "",
    video_url: "",
    gallery_urls: [],
    show_spots_remaining: false,
    multi_day: false
  };
}

// Populate the event modal from an existing event page for editing.
function eventPageToDraft(page: BookingEventPage): EventDraft {
  const meta = (page.metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: page.id,
    title: page.title || "",
    slug: page.slug || "",
    summary: page.summary || "",
    description: page.description || "",
    appointment_type_id: page.appointment_type_id || "",
    event_type: str(meta.event_type) || EVENT_TYPES[0],
    host_staff_user_id: page.host_staff_user_id || "",
    project_id: page.project_id || "",
    start_time: page.start_time ? toDateTimeLocal(new Date(page.start_time)) : "",
    end_time: page.end_time ? toDateTimeLocal(new Date(page.end_time)) : "",
    location_type: page.location_type || "in_person",
    location: page.location || "",
    capacity: page.capacity != null ? String(page.capacity) : "",
    status: (["draft", "published", "private"].includes(page.status) ? page.status : "draft") as EventDraft["status"],
    show_on_project_manager: Boolean(page.show_on_project_manager),
    photo_url: str(meta.photo_url),
    video_url: str(meta.video_url),
    gallery_urls: Array.isArray(meta.gallery_urls) ? (meta.gallery_urls as unknown[]).map(str).filter(Boolean) : [],
    show_spots_remaining: Boolean(meta.show_spots_remaining),
    // Multi-day when the start and end fall on different calendar days.
    multi_day: Boolean(page.start_time && page.end_time && page.start_time.slice(0, 10) !== page.end_time.slice(0, 10))
  };
}

export function BookingsClient({ initialData, demoMode, setupMessage }: { initialData: BookingData; demoMode: boolean; setupMessage?: string }) {
  const [data, setData] = React.useState(initialData);
  const [mode, setMode] = React.useState<ViewMode>("list");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState<BookingAppointment | null>(initialData.appointments[0] || null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [eventDraft, setEventDraft] = React.useState<EventDraft | null>(null);
  const [slotDate, setSlotDate] = React.useState(todayKey());
  const [slots, setSlots] = React.useState<BookingSlot[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(demoMode ? setupMessage || "Demo mode is using sample booking data. Add Supabase credentials for live writes." : null);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.appointments.filter(appointment => {
      const matchesSearch = !term || [appointment.title, appointment.customer_email, appointment.customer_phone, appointment.project_name, appointment.company_name].some(value => String(value || "").toLowerCase().includes(term));
      const matchesStatus = status === "all" || appointment.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [data.appointments, search, status]);

  const metrics = React.useMemo(() => {
    const now = new Date();
    return {
      total: data.appointments.length,
      upcoming: data.appointments.filter(item => new Date(item.start_time) >= now && !["canceled", "completed", "no_show"].includes(item.status)).length,
      pending: data.appointments.filter(item => item.status === "pending").length,
      confirmed: data.appointments.filter(item => item.status === "confirmed").length,
      linked: data.appointments.filter(item => item.contact_id || item.staff_user_id || item.project_id).length,
      timeline: data.appointments.filter(item => item.project_schedule_item_id || item.show_on_project_manager).length
    };
  }, [data.appointments]);

  const selectedType = React.useMemo(() => data.appointmentTypes.find(type => type.id === draft?.appointment_type_id) || data.appointmentTypes[0], [data.appointmentTypes, draft?.appointment_type_id]);

  async function loadSlots(typeId = draft?.appointment_type_id || data.appointmentTypes[0]?.id || "", date = slotDate) {
    if (!typeId || !date) return;
    if (demoMode) {
      const base = new Date(`${date}T09:00:00-07:00`);
      setSlots(Array.from({ length: 8 }, (_, index) => {
        const start = new Date(base.getTime() + index * 45 * 60 * 1000);
        const end = new Date(start.getTime() + (selectedType?.duration_minutes || 30) * 60 * 1000);
        return { start: start.toISOString(), end: end.toISOString(), label: start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) };
      }));
      return;
    }
    const response = await fetch(`/api/booking/availability?appointment_type_id=${encodeURIComponent(typeId)}&date=${encodeURIComponent(date)}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || "Could not load slots.");
    setSlots(json.slots || []);
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    try {
      if (demoMode) {
        const type = data.appointmentTypes.find(item => item.id === draft.appointment_type_id) || data.appointmentTypes[0];
        const start = draft.start_time || new Date().toISOString();
        const end = new Date(new Date(start).getTime() + (type?.duration_minutes || 30) * 60 * 1000).toISOString();
        const appointment = draftToAppointment(draft, type, start, end);
        setData(current => ({ ...current, appointments: [appointment, ...current.appointments] }));
        setSelected(appointment);
        setDraft(null);
        setNotice("Demo booking created locally and linked to the Project Manager sample flow.");
        return;
      }
      const response = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Booking create failed.");
      setData(current => ({ ...current, appointments: [json.appointment, ...current.appointments] }));
      setSelected(json.appointment);
      setDraft(null);
      setNotice("Booking created. Contact/user/project links were handled server-side.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Booking create failed.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAppointment(next: BookingAppointment, nextStatus: AppointmentStatus) {
    setSaving(true);
    setNotice(null);
    try {
      if (demoMode) {
        const updated = { ...next, status: nextStatus, updated_at: new Date().toISOString() };
        setData(current => ({ ...current, appointments: current.appointments.map(item => item.id === updated.id ? updated : item) }));
        setSelected(updated);
        setNotice("Demo appointment updated locally.");
        return;
      }
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: next.id, status: nextStatus, assigned_staff_user_id: next.assigned_staff_user_id, project_id: next.project_id, project_name: next.project_name, internal_notes: next.internal_notes })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Booking update failed.");
      setData(current => ({ ...current, appointments: current.appointments.map(item => item.id === json.appointment.id ? json.appointment : item) }));
      setSelected(json.appointment);
      setNotice("Appointment updated and linked schedule status was synced.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Booking update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment(appointment: BookingAppointment) {
    if (!window.confirm(`Delete "${appointment.title || "this appointment"}"? This can't be undone.`)) return;
    setSaving(true);
    setNotice(null);
    try {
      if (demoMode) {
        setData(current => ({ ...current, appointments: current.appointments.filter(item => item.id !== appointment.id) }));
        setSelected(current => (current?.id === appointment.id ? null : current));
        setNotice("Demo appointment removed locally.");
        return;
      }
      const response = await fetch(`/api/admin/bookings?id=${encodeURIComponent(appointment.id)}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Booking delete failed.");
      setData(current => ({ ...current, appointments: current.appointments.filter(item => item.id !== appointment.id) }));
      setSelected(current => (current?.id === appointment.id ? null : current));
      setNotice("Appointment deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Booking delete failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Schedule</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Bookings</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Manage CMI appointments, connect bookings to contacts and users, and push relevant meetings into the Project Manager timeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.open("/book", "_blank")}>
            Public Booking
          </Button>
          <Button variant="outline" onClick={() => setEventDraft(emptyEventDraft(data.appointmentTypes))}>
            One-Time Event
          </Button>
          <Button variant="accent" onClick={() => { setDraft(emptyDraft(data.appointmentTypes)); setSlots([]); }}>
            <Plus className="h-4 w-4" />
            Add Appointment
          </Button>
        </div>
      </header>

      {notice ? <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Total", metrics.total],
          ["Upcoming", metrics.upcoming],
          ["Pending", metrics.pending],
          ["Confirmed", metrics.confirmed],
          ["Linked Records", metrics.linked],
          ["Project Timeline", metrics.timeline]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
              <div className="mt-3 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-border bg-card p-1">
          {(["list", "calendar", "events", "availability"] as ViewMode[]).map(item => (
            <button key={item} type="button" className={cn("rounded px-3 py-1.5 text-sm capitalize", mode === item ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")} onClick={() => setMode(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-[240px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search bookings..." />
          </div>
          <Select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map(item => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>
      </div>

      {mode === "list" ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
              <CardDescription>Bookings can link to contacts, users, staff assignments, projects, and Project Manager schedule items.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[1.4fr_1fr_150px_130px_130px] border-b border-border bg-muted/40 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <div>Appointment</div><div>When</div><div>Project</div><div>Status</div><div>Links</div>
                </div>
                {filtered.map(appointment => (
                  <div
                    key={appointment.id}
                    role="button"
                    tabIndex={0}
                    className={cn("grid w-full grid-cols-[1.4fr_1fr_150px_130px_130px] items-center border-b border-border px-4 py-3 text-left text-sm hover:bg-muted/50", selected?.id === appointment.id && "bg-accent/8")}
                    onClick={() => setSelected(appointment)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(appointment);
                      }
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{appointment.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{appointment.customer_email || "No email"} {appointment.customer_phone ? `- ${appointment.customer_phone}` : ""}</div>
                    </div>
                    <div className="text-muted-foreground">{formatDateTime(appointment.start_time)}</div>
                    <div className="truncate text-muted-foreground">{appointment.project_name || "-"}</div>
                    <div><Badge tone={statusTone[appointment.status]}>{appointment.status}</Badge></div>
                    <AppointmentLinksFab appointment={appointment} onDelete={deleteAppointment} />
                  </div>
                ))}
                {!filtered.length ? <div className="p-8 text-center text-sm text-muted-foreground">No bookings match those filters.</div> : null}
              </div>
            </CardContent>
          </Card>
          <AppointmentDetail appointment={selected} saving={saving} onStatus={updateAppointment} />
        </section>
      ) : mode === "calendar" ? (
        <CalendarPanel appointments={filtered} onSelect={setSelected} />
      ) : mode === "events" ? (
        <EventsPanel data={data} onCreate={() => setEventDraft(emptyEventDraft(data.appointmentTypes))} onEdit={page => setEventDraft(eventPageToDraft(page))} onDelete={deleteEventPage} />
      ) : (
        <AvailabilityPanel data={data} />
      )}

      {draft ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4">
          <div className="ml-auto h-full w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
            <form onSubmit={saveDraft}>
              <div className="flex items-start justify-between border-b border-border p-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Appointment</div>
                  <h2 className="mt-2 font-display text-2xl font-semibold">Add Appointment</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Create or link the contact, optionally invite a client user, and add this to the Project Manager timeline.</p>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => setDraft(null)}><XCircle className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="Appointment Type">
                  <Select value={draft.appointment_type_id} onChange={event => { setDraft({ ...draft, appointment_type_id: event.target.value, start_time: "" }); setSlots([]); }}>
                    {data.appointmentTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </Select>
                </Field>
                <Field label="Date">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input type="date" value={slotDate} onChange={event => setSlotDate(event.target.value)} />
                    <Button type="button" variant="outline" onClick={() => loadSlots()}>Find Times</Button>
                  </div>
                </Field>
                <div className="md:col-span-2">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Available Times</div>
                  <div className="flex flex-wrap gap-2">
                    {slots.map(slot => (
                      <button key={slot.start} type="button" className={cn("rounded-md border border-border px-3 py-2 text-sm", draft.start_time === slot.start ? "border-accent bg-accent text-accent-foreground" : "hover:border-accent")} onClick={() => setDraft({ ...draft, start_time: slot.start })}>
                        {slot.label}
                      </button>
                    ))}
                    {!slots.length ? <span className="text-sm text-muted-foreground">Choose an appointment type and date, then find times.</span> : null}
                  </div>
                </div>
                <Field label="First Name *"><Input required value={draft.first_name || ""} onChange={event => setDraft({ ...draft, first_name: event.target.value })} /></Field>
                <Field label="Last Name *"><Input required value={draft.last_name || ""} onChange={event => setDraft({ ...draft, last_name: event.target.value })} /></Field>
                <Field label="Email *"><Input required type="email" value={draft.email || ""} onChange={event => setDraft({ ...draft, email: event.target.value })} /></Field>
                <Field label="Phone"><Input value={draft.phone || ""} onChange={event => setDraft({ ...draft, phone: event.target.value })} /></Field>
                <Field label="Company"><Input value={draft.company_name || ""} onChange={event => setDraft({ ...draft, company_name: event.target.value })} /></Field>
                <Field label="Project">
                  <Select value={draft.project_id || ""} onChange={event => {
                    const project = data.projects.find(item => item.id === event.target.value);
                    setDraft({ ...draft, project_id: event.target.value, project_name: project?.title || draft.project_name });
                  }}>
                    <option value="">No linked project</option>
                    {data.projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                  </Select>
                </Field>
                <Field label="Project Name"><Input value={draft.project_name || ""} onChange={event => setDraft({ ...draft, project_name: event.target.value })} /></Field>
                <Field label="Assigned Staff">
                  <Select value={draft.assigned_staff_user_id || ""} onChange={event => setDraft({ ...draft, assigned_staff_user_id: event.target.value })}>
                    <option value="">Unassigned</option>
                    {data.users.filter(user => !["client", "vendor", "subcontractor"].includes(user.role_slug)).map(user => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                  </Select>
                </Field>
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={Boolean(draft.create_or_link_user)} onChange={event => setDraft({ ...draft, create_or_link_user: event.target.checked })} /><UserPlus className="h-4 w-4 text-accent" /> Create/link client user</label>
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={Boolean(draft.show_on_project_manager)} onChange={event => setDraft({ ...draft, show_on_project_manager: event.target.checked })} /><CalendarClock className="h-4 w-4 text-accent" /> Show on Project Manager</label>
                <Field label="Notes" className="md:col-span-2"><Textarea value={draft.notes || ""} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></Field>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-border p-5">
                <Button type="submit" variant="accent" disabled={saving || !draft.start_time}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Appointment</Button>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {eventDraft ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4">
          <div className="ml-auto h-full w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
            <form onSubmit={event => saveEventDraft(event)}>
              <div className="flex items-start justify-between border-b border-border p-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">One-Time Event</div>
                  <h2 className="mt-2 font-display text-2xl font-semibold">{eventDraft.id ? "Edit Event Page" : "Create Event Page"}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Publish a frontend event page that can register contacts, optional client users, and Project Manager timeline items.</p>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => setEventDraft(null)}><XCircle className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="Title *"><Input required value={eventDraft.title} onChange={event => setEventDraft({ ...eventDraft, title: event.target.value })} /></Field>
                <Field label="Slug"><Input value={eventDraft.slug} onChange={event => setEventDraft({ ...eventDraft, slug: event.target.value })} placeholder="event-page-url" /></Field>
                <Field label="Event Type">
                  <Select value={eventDraft.event_type} onChange={event => setEventDraft({ ...eventDraft, event_type: event.target.value })}>
                    {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </Select>
                </Field>
                <Field label="Host Staff">
                  <Select value={eventDraft.host_staff_user_id} onChange={event => setEventDraft({ ...eventDraft, host_staff_user_id: event.target.value })}>
                    <option value="">No host selected</option>
                    {data.users.filter(user => !["client", "vendor", "subcontractor"].includes(user.role_slug)).map(user => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                  </Select>
                </Field>
                <div className="space-y-3 md:col-span-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                    <input type="checkbox" checked={eventDraft.multi_day} onChange={event => {
                      const checked = event.target.checked;
                      setEventDraft(current => {
                        if (!current) return current;
                        // Leaving multi-day: collapse the end onto the start's date.
                        if (!checked) return { ...current, multi_day: false, end_time: joinDateTime(datePartOf(current.start_time), timePartOf(current.end_time)) };
                        return { ...current, multi_day: true };
                      });
                    }} />
                    <CalendarClock className="h-4 w-4 text-accent" /> Multi-day event
                  </label>
                  {eventDraft.multi_day ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Start *"><Input required type="datetime-local" value={eventDraft.start_time} onChange={event => setEventDraft({ ...eventDraft, start_time: event.target.value })} /></Field>
                      <Field label="End *"><Input required type="datetime-local" value={eventDraft.end_time} onChange={event => setEventDraft({ ...eventDraft, end_time: event.target.value })} /></Field>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Date *">
                        <Input required type="date" value={datePartOf(eventDraft.start_time)} onChange={event => {
                          const date = event.target.value;
                          setEventDraft(current => current ? { ...current, start_time: joinDateTime(date, timePartOf(current.start_time)), end_time: joinDateTime(date, timePartOf(current.end_time)) } : current);
                        }} />
                      </Field>
                      <Field label="Start Time *">
                        <Input required type="time" value={timePartOf(eventDraft.start_time)} onChange={event => {
                          const time = event.target.value;
                          setEventDraft(current => current ? { ...current, start_time: joinDateTime(datePartOf(current.start_time) || datePartOf(current.end_time), time) } : current);
                        }} />
                      </Field>
                      <Field label="End Time *">
                        <Input required type="time" value={timePartOf(eventDraft.end_time)} onChange={event => {
                          const time = event.target.value;
                          setEventDraft(current => current ? { ...current, end_time: joinDateTime(datePartOf(current.start_time) || datePartOf(current.end_time), time) } : current);
                        }} />
                      </Field>
                    </div>
                  )}
                </div>
                <Field label="Project">
                  <Select value={eventDraft.project_id} onChange={event => setEventDraft({ ...eventDraft, project_id: event.target.value })}>
                    <option value="">No linked project</option>
                    {data.projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={eventDraft.status} onChange={event => setEventDraft({ ...eventDraft, status: event.target.value as EventDraft["status"] })}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="private">Private</option>
                  </Select>
                </Field>
                <Field label="Location Type"><Input value={eventDraft.location_type} onChange={event => setEventDraft({ ...eventDraft, location_type: event.target.value })} /></Field>
                <Field label="Location"><Input value={eventDraft.location} onChange={event => setEventDraft({ ...eventDraft, location: event.target.value })} /></Field>
                <Field label="Capacity"><Input type="number" value={eventDraft.capacity} onChange={event => setEventDraft({ ...eventDraft, capacity: event.target.value })} /></Field>
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={eventDraft.show_on_project_manager} onChange={event => setEventDraft({ ...eventDraft, show_on_project_manager: event.target.checked })} /><CalendarClock className="h-4 w-4 text-accent" /> Show on Project Manager</label>
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={eventDraft.show_spots_remaining} onChange={event => setEventDraft({ ...eventDraft, show_spots_remaining: event.target.checked })} /><Users className="h-4 w-4 text-accent" /> Show spots remaining on public page</label>
                <Field label="Summary" className="md:col-span-2"><Input value={eventDraft.summary} onChange={event => setEventDraft({ ...eventDraft, summary: event.target.value })} /></Field>
                <Field label="Description" className="md:col-span-2"><Textarea value={eventDraft.description} onChange={event => setEventDraft({ ...eventDraft, description: event.target.value })} /></Field>
                <MediaUploadField label="Photo" accept="image/*" folder="event-pages" demoMode={demoMode} value={eventDraft.photo_url} onChange={url => setEventDraft(current => current ? { ...current, photo_url: url } : current)} />
                <MediaUploadField label="Video" accept="video/*" folder="event-pages" demoMode={demoMode} value={eventDraft.video_url} onChange={url => setEventDraft(current => current ? { ...current, video_url: url } : current)} />
                <GalleryUploadField className="md:col-span-2" folder="event-pages" demoMode={demoMode} values={eventDraft.gallery_urls} onChange={urls => setEventDraft(current => current ? { ...current, gallery_urls: urls } : current)} />
              </div>
              <div className="flex flex-wrap gap-3 border-t border-border p-5">
                <Button type="submit" variant="accent" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {eventDraft.id ? "Save Changes" : "Create Event Page"}</Button>
                <Button type="button" variant="outline" onClick={() => setEventDraft(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );

  async function saveEventDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventDraft) return;
    const isEdit = Boolean(eventDraft.id);
    setSaving(true);
    setNotice(null);
    try {
      if (demoMode) {
        setNotice(isEdit ? "Demo event page updated locally." : "Demo event page created locally. Live mode will publish /events/[slug] and queue staff calendar sync.");
        setEventDraft(null);
        return;
      }
      const response = await fetch("/api/admin/bookings", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...eventDraft,
          resource: "event_page",
          capacity: eventDraft.capacity ? Number(eventDraft.capacity) : null,
          gallery_urls: eventDraft.gallery_urls.filter(Boolean)
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || (isEdit ? "Event page update failed." : "Event page create failed."));
      setData(current => ({
        ...current,
        eventPages: isEdit
          ? current.eventPages.map(page => (page.id === json.eventPage.id ? json.eventPage : page))
          : [json.eventPage, ...current.eventPages]
      }));
      setEventDraft(null);
      setNotice(isEdit ? `Event page updated: /events/${json.eventPage.slug}` : `Event page created: /events/${json.eventPage.slug}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Event page save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEventPage(page: BookingEventPage) {
    if (!window.confirm(`Delete the event page "${page.title}"? This removes /events/${page.slug} and can't be undone.`)) return;
    setSaving(true);
    setNotice(null);
    try {
      if (demoMode) {
        setData(current => ({ ...current, eventPages: current.eventPages.filter(item => item.id !== page.id) }));
        setNotice("Demo event page removed locally.");
        return;
      }
      const response = await fetch(`/api/admin/bookings?resource=event_page&id=${encodeURIComponent(page.id)}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Event page delete failed.");
      setData(current => ({ ...current, eventPages: current.eventPages.filter(item => item.id !== page.id) }));
      setNotice("Event page deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Event page delete failed.");
    } finally {
      setSaving(false);
    }
  }
}

function AppointmentDetail({ appointment, saving, onStatus }: { appointment: BookingAppointment | null; saving: boolean; onStatus: (appointment: BookingAppointment, status: AppointmentStatus) => void }) {
  if (!appointment) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Select an appointment to view details.</CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{appointment.title}</CardTitle>
        <CardDescription>{formatDateTime(appointment.start_time)} - {formatTime(appointment.end_time)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials(`${appointment.customer_first_name || ""} ${appointment.customer_last_name || ""}`)}</div>
          <div>
            <div className="font-medium">{[appointment.customer_first_name, appointment.customer_last_name].filter(Boolean).join(" ") || "Unnamed contact"}</div>
            <div className="text-sm text-muted-foreground">{appointment.customer_email || "-"} {appointment.customer_phone ? `- ${appointment.customer_phone}` : ""}</div>
          </div>
        </div>
        <div className="grid gap-2 text-sm">
          <Info label="Status" value={appointment.status} />
          <Info label="Project" value={appointment.project_name || "-"} />
          <Info label="Location" value={appointment.location || appointment.location_type} />
          <Info label="Client visible" value={appointment.client_visible ? "Yes" : "No"} />
          <Info label="Project Manager" value={appointment.project_schedule_item_id ? "Linked to schedule item" : appointment.show_on_project_manager ? "Ready to link" : "Hidden"} />
        </div>
        {appointment.customer_notes ? <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{appointment.customer_notes}</div> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={saving} onClick={() => onStatus(appointment, "confirmed")}><Clock className="h-4 w-4" /> Confirm</Button>
          <Button variant="accent" disabled={saving} onClick={() => onStatus(appointment, "completed")}><CheckCircle2 className="h-4 w-4" /> Complete</Button>
          <Button variant="destructive" disabled={saving} onClick={() => onStatus(appointment, "canceled")}><XCircle className="h-4 w-4" /> Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarPanel({ appointments, onSelect }: { appointments: BookingAppointment[]; onSelect: (appointment: BookingAppointment) => void }) {
  const grouped = appointments.reduce<Record<string, BookingAppointment[]>>((acc, appointment) => {
    const key = appointment.start_time.slice(0, 10);
    acc[key] = [...(acc[key] || []), appointment];
    return acc;
  }, {});
  return (
    <Card>
      <CardHeader><CardTitle>Calendar</CardTitle><CardDescription>Simple appointment calendar grouped by date. Full month/week calendar controls can build from this data.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="rounded-lg border border-border p-4">
            <div className="mb-3 text-sm font-semibold">{new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
            <div className="space-y-2">
              {items.map(item => <button key={item.id} className="w-full rounded-md bg-muted/40 p-3 text-left text-sm hover:bg-muted" onClick={() => onSelect(item)}>{formatTime(item.start_time)} - {item.title}</button>)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AvailabilityPanel({ data }: { data: BookingData }) {
  return (
    <Card>
      <CardHeader><CardTitle>Availability</CardTitle><CardDescription>Phase 1 reads availability rules from Supabase. Editing rules and blocked time can come next.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.availabilityRules.map(rule => (
          <div key={rule.id} className="rounded-lg border border-border p-4 text-sm">
            <div className="font-medium">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][rule.day_of_week]}</div>
            <div className="mt-1 text-muted-foreground">{rule.start_time} - {rule.end_time}</div>
            <Badge className="mt-3" tone={rule.is_available ? "success" : "danger"}>{rule.is_available ? "Available" : "Blocked"}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function eventTypeOf(eventPage: BookingEventPage): string {
  const meta = (eventPage.metadata ?? {}) as Record<string, unknown>;
  return typeof meta.event_type === "string" ? meta.event_type : "";
}

function EventsPanel({ data, onCreate, onEdit, onDelete }: { data: BookingData; onCreate: () => void; onEdit: (page: BookingEventPage) => void; onDelete: (page: BookingEventPage) => void }) {
  const [typeFilter, setTypeFilter] = React.useState("all");

  // Distinct event types present across the current pages, used to build the filter.
  const presentTypes = React.useMemo(() => {
    const set = new Set<string>();
    for (const page of data.eventPages) { const type = eventTypeOf(page); if (type) set.add(type); }
    return Array.from(set).sort();
  }, [data.eventPages]);

  const visiblePages = React.useMemo(
    () => (typeFilter === "all" ? data.eventPages : data.eventPages.filter(page => eventTypeOf(page) === typeFilter)),
    [data.eventPages, typeFilter]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>One-Time Event Pages</CardTitle>
            <CardDescription>Frontend event pages can register contacts, create users, connect staff calendars, and show on the Project Manager.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {presentTypes.length ? (
              <Select className="md:w-48" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
                <option value="all">All event types</option>
                {presentTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </Select>
            ) : null}
            <Button variant="accent" onClick={onCreate}><Plus className="h-4 w-4" /> New Event</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visiblePages.map(eventPage => {
          const host = data.users.find(user => user.id === eventPage.host_staff_user_id);
          const eventType = eventTypeOf(eventPage);
          return (
            <div key={eventPage.id} className="grid gap-3 rounded-lg border border-border p-4 text-sm md:grid-cols-[1fr_150px_130px_110px_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{eventPage.title}</span>
                  {eventType ? <Badge tone="accent">{eventType}</Badge> : null}
                </div>
                <div className="mt-1 text-muted-foreground">/events/{eventPage.slug}</div>
              </div>
              <div className="text-muted-foreground">{formatDateTime(eventPage.start_time)}</div>
              <div className="text-muted-foreground">{host?.display_name || "No host"}</div>
              <Badge tone={eventPage.status === "published" ? "success" : "warning"}>{eventPage.status}</Badge>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(eventPage)}>Edit</Button>
                <Button variant="outline" size="sm" onClick={() => window.open(`/events/${eventPage.slug}`, "_blank")}>Open</Button>
                <button type="button" onClick={() => onDelete(eventPage)} className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition hover:border-destructive hover:text-destructive" title="Delete event page" aria-label="Delete event page">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
        {!data.eventPages.length ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No event pages yet.</div> : null}
        {data.eventPages.length > 0 && visiblePages.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No events match this type.</div> : null}

        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          <div className="font-medium">Staff Calendar Sync Foundation</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Calendar connections are stored per staff member with one-way, two-way, or three-way sync direction. OAuth/provider workers still need to be added before live Google or Outlook syncing.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.calendarConnections.map(connection => {
              const staff = data.users.find(user => user.id === connection.staff_user_id);
              return (
                <div key={connection.id} className="rounded-md border border-border bg-card p-3 text-sm">
                  <div className="font-medium">{staff?.display_name || connection.provider_account_email || "Calendar"}</div>
                  <div className="mt-1 text-muted-foreground">{connection.provider} - {connection.sync_direction}</div>
                  <Badge className="mt-2" tone={connection.status === "connected" ? "success" : connection.status === "error" ? "danger" : "warning"}>{connection.status}</Badge>
                </div>
              );
            })}
            {!data.calendarConnections.length ? <div className="text-sm text-muted-foreground">No staff calendars connected yet.</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={cn("block text-sm font-medium", className)}><span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>{children}</label>;
}

// Single-asset picker: upload a file to the media bucket, or paste a URL as a
// secondary option. Used for the event page Photo and Video fields.
function MediaUploadField({ label, accept, folder, value, demoMode, onChange, className }: { label: string; accept: string; folder: string; value: string; demoMode: boolean; onChange: (url: string) => void; className?: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isImage = accept.startsWith("image/");

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try { onChange(await uploadToMedia(file, folder)); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <Field label={label} className={className}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => void pick(e.target.files?.[0] ?? undefined)} />
          <Button type="button" variant="outline" size="sm" disabled={busy || demoMode} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </Button>
          {value ? <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"><XCircle className="h-3.5 w-3.5" /> Remove</button> : null}
        </div>
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder={demoMode ? "Paste a URL (upload disabled in demo)" : "…or paste a URL"} />
        {value && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-auto rounded-md border border-border object-cover" />
        ) : value ? <div className="truncate text-xs text-muted-foreground">{value}</div> : null}
        {error ? <div className="text-xs text-destructive">{error}</div> : null}
      </div>
    </Field>
  );
}

// Multi-asset picker for the event page Gallery: upload one or more images, or
// add by URL. Renders removable thumbnails.
function GalleryUploadField({ values, folder, demoMode, onChange, className }: { values: string[]; folder: string; demoMode: boolean; onChange: (urls: string[]) => void; className?: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [url, setUrl] = React.useState("");

  async function pick(files: FileList | null) {
    if (!files || !files.length) return;
    setError(null);
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) uploaded.push(await uploadToMedia(file, folder));
      onChange([...values, ...uploaded]);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  function addUrl() {
    const trimmed = url.trim();
    if (!trimmed) return;
    onChange([...values, trimmed]);
    setUrl("");
  }

  return (
    <Field label="Gallery" className={className}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => void pick(e.target.files)} />
          <Button type="button" variant="outline" size="sm" disabled={busy || demoMode} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload images
          </Button>
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} placeholder="…or paste a URL" />
            <Button type="button" variant="outline" size="sm" onClick={addUrl}>Add</Button>
          </div>
        </div>
        {values.length ? (
          <div className="flex flex-wrap gap-2">
            {values.map((item, index) => (
              <div key={`${item}-${index}`} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
                <button type="button" onClick={() => onChange(values.filter((_, i) => i !== index))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-white shadow" title="Remove" aria-label="Remove image">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <div className="text-xs text-destructive">{error}</div> : null}
      </div>
    </Field>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 border-b border-border pb-2"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function draftToAppointment(draft: Draft, type: AppointmentType | undefined, start: string, end: string): BookingAppointment {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    appointment_type_id: type?.id || null,
    contact_id: crypto.randomUUID(),
    staff_user_id: draft.create_or_link_user ? crypto.randomUUID() : null,
    assigned_staff_user_id: draft.assigned_staff_user_id || null,
    project_id: draft.project_id || null,
    project_schedule_item_id: draft.show_on_project_manager ? crypto.randomUUID() : null,
    title: `${type?.name || "Appointment"}: ${draft.first_name || ""} ${draft.last_name || ""}`.trim(),
    customer_first_name: draft.first_name || null,
    customer_last_name: draft.last_name || null,
    customer_email: draft.email || null,
    customer_phone: draft.phone || null,
    company_name: draft.company_name || null,
    start_time: start,
    end_time: end,
    timezone: "America/Phoenix",
    status: "confirmed",
    location_type: type?.location_type || "phone_call",
    location: null,
    meeting_url: null,
    project_name: draft.project_name || null,
    customer_notes: draft.notes || null,
    internal_notes: null,
    cancellation_reason: null,
    client_visible: type?.client_visible ?? true,
    show_on_project_manager: Boolean(draft.show_on_project_manager),
    create_or_link_user: Boolean(draft.create_or_link_user),
    email_consent: draft.email_consent !== false,
    sms_consent: Boolean(draft.sms_consent),
    created_at: now,
    updated_at: now
  };
}
