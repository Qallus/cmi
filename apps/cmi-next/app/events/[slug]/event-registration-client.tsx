"use client";

import * as React from "react";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

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
};

export function EventRegistrationClient({ eventPage }: { eventPage: EventRecord }) {
  const [form, setForm] = React.useState({ first_name: "", last_name: "", email: "", phone: "", company_name: "", notes: "", sms_consent: false, create_or_link_user: true });
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const isFull = Boolean(eventPage.capacity && eventPage.registration_count >= eventPage.capacity);

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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_420px]">
        <section>
          <img src="/brand/cmi-logo-light.png" alt="Constructed Matter, Inc." className="h-9 w-auto object-contain dark:hidden" />
          <img src="/brand/cmi-logo-dark.png" alt="Constructed Matter, Inc." className="hidden h-9 w-auto object-contain dark:block" />
          <div className="mt-10 text-[10px] uppercase tracking-[0.18em] text-accent">CMI Event</div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{eventPage.title}</h1>
          {eventPage.summary ? <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{eventPage.summary}</p> : null}
          <Card className="mt-8">
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              <Info label="When" value={`${formatDateTime(eventPage.start_time)} - ${formatTime(eventPage.end_time)}`} />
              <Info label="Location" value={eventPage.location || eventPage.location_type.replace(/_/g, " ")} />
              <Info label="Availability" value={eventPage.capacity ? `${eventPage.registration_count}/${eventPage.capacity} registered` : "Open registration"} />
            </CardContent>
          </Card>
          {eventPage.description ? <div className="mt-8 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{eventPage.description}</div> : null}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Register</CardTitle>
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
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className="mt-2 text-sm font-medium">{value}</div></div>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
