"use client";

import * as React from "react";
import { CalendarClock, CheckCircle2, Loader2, MapPin, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EventRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  location_type: string;
  location: string | null;
  meeting_url: string | null;
  capacity: number | null;
  registration_count: number;
  requires_approval: boolean;
  metadata?: Record<string, unknown> | null;
};

function readMedia(metadata: Record<string, unknown> | null | undefined) {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const gallery = Array.isArray(meta.gallery_urls)
    ? (meta.gallery_urls as unknown[]).map(str).filter(Boolean)
    : [];
  return {
    eventType: str(meta.event_type),
    photoUrl: str(meta.photo_url),
    videoUrl: str(meta.video_url),
    gallery,
    showSpots: Boolean(meta.show_spots_remaining),
  };
}

export function EventRegistrationClient({ eventPage }: { eventPage: EventRecord }) {
  const [form, setForm] = React.useState({ first_name: "", last_name: "", email: "", phone: "", company_name: "", notes: "", sms_consent: false, create_or_link_user: true });
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const isFull = Boolean(eventPage.capacity && eventPage.registration_count >= eventPage.capacity);
  const { eventType, photoUrl, videoUrl, gallery, showSpots } = readMedia(eventPage.metadata);
  const spotsRemaining = eventPage.capacity != null ? Math.max(0, eventPage.capacity - (eventPage.registration_count || 0)) : null;
  const showSpotsRemaining = showSpots && spotsRemaining != null;

  React.useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/booking/events/${eventPage.slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email_consent: true })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Registration failed.");
      setDone(true);
      setNotice(eventPage.requires_approval ? "Registration received. The CMI team will approve or follow up." : "You are registered for this event.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-accent">CMI Event</span>
          {eventType ? <Badge tone="accent">{eventType}</Badge> : null}
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{eventPage.title}</h1>
        {eventPage.summary ? <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{eventPage.summary}</p> : null}
        {photoUrl ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={eventPage.title} className="max-h-[460px] w-full object-cover" />
          </div>
        ) : null}
        <Card className="mt-8">
          <CardContent className="grid gap-6 p-6 sm:grid-cols-3">
            <Info icon={CalendarClock} label="When" value={`${formatDateTime(eventPage.start_time)} - ${formatTime(eventPage.end_time)}`} />
            <Info icon={MapPin} label="Location" value={eventPage.location || eventPage.location_type.replace(/_/g, " ")} />
            <Info icon={Users} label="Availability" value={showSpotsRemaining ? `${spotsRemaining} ${spotsRemaining === 1 ? "spot" : "spots"} remaining` : eventPage.capacity ? `${eventPage.registration_count}/${eventPage.capacity} registered` : "Open registration"} />
          </CardContent>
        </Card>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_400px]">
          <section>
          {eventPage.description ? <div className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{eventPage.description}</div> : null}
          {videoUrl ? (
            <div className="mt-8 max-w-3xl">
              <div className="mb-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Video</div>
              <EventVideo url={videoUrl} />
            </div>
          ) : null}
          {gallery.length ? (
            <div className="mt-8">
              <div className="mb-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Gallery</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((url, index) => (
                  <button key={`${url}-${index}`} type="button" onClick={() => setLightbox(url)} className="group overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${eventPage.title} photo ${index + 1}`} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <Card className="self-start shadow-lg lg:sticky lg:top-24">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle>Register</CardTitle>
              {showSpotsRemaining ? (
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", spotsRemaining === 0 ? "bg-destructive/10 text-destructive" : "bg-accent/15 text-accent")}>
                  {spotsRemaining === 0 ? "Full" : `${spotsRemaining} ${spotsRemaining === 1 ? "spot" : "spots"} left`}
                </span>
              ) : null}
            </div>
            <CardDescription>{eventPage.requires_approval ? "CMI will review this registration before confirming." : "Reserve your spot for this one-time event."}</CardDescription>
          </CardHeader>
          <CardContent>
            {notice ? <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{notice}</div> : null}
            {done ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <div className="mt-3 font-medium">Registration received</div>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={submit}>
                <Input required placeholder="First name" value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} />
                <Input required placeholder="Last name" value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} />
                <Input required type="email" placeholder="Email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
                <Input placeholder="Phone" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} />
                <Input placeholder="Company / project" value={form.company_name} onChange={event => setForm({ ...form, company_name: event.target.value })} />
                <Textarea placeholder="Notes for CMI..." value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                  <input type="checkbox" checked={form.create_or_link_user} onChange={event => setForm({ ...form, create_or_link_user: event.target.checked })} />
                  Prepare client access if needed
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                  <input type="checkbox" checked={form.sms_consent} onChange={event => setForm({ ...form, sms_consent: event.target.checked })} />
                  Send appointment updates by SMS
                </label>
                <Button type="submit" variant="accent" className="w-full" disabled={saving || isFull}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  {isFull ? "Event Full" : "Register"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {lightbox ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setLightbox(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Close image">
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain" onClick={event => event.stopPropagation()} />
        </div>
      ) : null}
    </main>
  );
}

// Embed an event video: YouTube/Vimeo links render as players; a direct file
// (e.g. an uploaded .mp4) renders as a native <video>.
function EventVideo({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    return <iframe className="aspect-video w-full rounded-xl border border-border" src={`https://www.youtube.com/embed/${yt[1]}`} title="Event video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return <iframe className="aspect-video w-full rounded-xl border border-border" src={`https://player.vimeo.com/video/${vimeo[1]}`} title="Event video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
  }
  return <video className="aspect-video w-full rounded-xl border border-border bg-black" src={url} controls preload="metadata" />;
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-medium leading-6">{value}</div>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
