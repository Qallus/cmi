"use client";

import * as React from "react";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AppointmentType, BookingSlot } from "@/lib/booking/types";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function PublicBookingClient({ appointmentTypes, demoMode, setupMessage }: { appointmentTypes: AppointmentType[]; demoMode: boolean; setupMessage?: string }) {
  const [selectedTypeId, setSelectedTypeId] = React.useState(appointmentTypes[0]?.id || "");
  const [date, setDate] = React.useState(todayKey());
  const [slots, setSlots] = React.useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = React.useState("");
  const [form, setForm] = React.useState({ first_name: "", last_name: "", email: "", phone: "", company_name: "", project_name: "", notes: "", sms_consent: false });
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(demoMode ? setupMessage || "Demo mode is using sample booking options." : null);
  const [confirmed, setConfirmed] = React.useState(false);
  const selectedType = appointmentTypes.find(type => type.id === selectedTypeId) || appointmentTypes[0];

  async function loadSlots() {
    if (!selectedTypeId || !date) return;
    setLoading(true);
    setNotice(null);
    try {
      if (demoMode) {
        const base = new Date(`${date}T09:00:00-07:00`);
        setSlots(Array.from({ length: 8 }, (_, index) => {
          const start = new Date(base.getTime() + index * 45 * 60 * 1000);
          const end = new Date(start.getTime() + (selectedType?.duration_minutes || 30) * 60 * 1000);
          return { start: start.toISOString(), end: end.toISOString(), label: start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) };
        }));
        return;
      }
      const response = await fetch(`/api/booking/availability?appointment_type_id=${encodeURIComponent(selectedTypeId)}&date=${encodeURIComponent(date)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Could not load availability.");
      setSlots(json.slots || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load availability.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) {
      setNotice("Choose an available time before requesting the appointment.");
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      if (demoMode) {
        setConfirmed(true);
        setNotice("Demo appointment request received. Live booking will create a contact, optional client user, and project timeline item.");
        return;
      }
      const response = await fetch("/api/booking/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_type_id: selectedTypeId,
          start_time: selectedSlot,
          ...form,
          create_or_link_user: true,
          show_on_project_manager: Boolean(form.project_name),
          email_consent: true
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Appointment request failed.");
      setConfirmed(true);
      setNotice("Your appointment request has been received. The CMI team will confirm the details.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Appointment request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:py-12">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <img src="/brand/cmi-logo-light.png" alt="Constructed Matter, Inc." className="h-9 w-auto object-contain dark:hidden" />
            <img src="/brand/cmi-logo-dark.png" alt="Constructed Matter, Inc." className="hidden h-9 w-auto object-contain dark:block" />
            <div className="mt-8 text-[10px] uppercase tracking-[0.18em] text-accent">Book Appointment</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Schedule With Constructed Matter</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Choose a construction appointment type, select a time, and share enough context for the CMI team to connect it to your contact and project record.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Arizona time<br />
            Client, vendor, and subcontractor friendly
          </div>
        </header>

        {notice ? <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

        {confirmed ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <h2 className="mt-4 font-display text-2xl font-semibold">Appointment Request Received</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">CMI will confirm the appointment and connect it to your project record if one exists.</p>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <section className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Appointment Type</CardTitle>
                  <CardDescription>Select the meeting that best matches what you need.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {appointmentTypes.map(type => (
                    <button key={type.id} type="button" className={cn("rounded-lg border border-border p-4 text-left transition hover:border-accent", selectedTypeId === type.id && "border-accent bg-accent/10")} onClick={() => { setSelectedTypeId(type.id); setSelectedSlot(""); setSlots([]); }}>
                      <div className="font-medium">{type.name}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{type.description}</div>
                      <div className="mt-3 text-xs text-muted-foreground">{type.duration_minutes} minutes</div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Date & Time</CardTitle>
                  <CardDescription>Available times are shown in Arizona time.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-[240px_auto]">
                    <Input type="date" value={date} onChange={event => setDate(event.target.value)} />
                    <Button type="button" variant="outline" onClick={loadSlots} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                      Check Availability
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {slots.map(slot => (
                      <button key={slot.start} type="button" className={cn("rounded-md border border-border px-3 py-2 text-sm", selectedSlot === slot.start ? "border-accent bg-accent text-accent-foreground" : "hover:border-accent")} onClick={() => setSelectedSlot(slot.start)}>
                        {slot.label}
                      </button>
                    ))}
                    {!slots.length ? <span className="text-sm text-muted-foreground">Pick a date and check availability.</span> : null}
                  </div>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>This creates or updates a contact and can prepare client access if needed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                  <Input required placeholder="First name" value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} />
                  <Input required placeholder="Last name" value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} />
                  <Input required type="email" placeholder="Email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
                  <Input placeholder="Phone" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} />
                  <Input placeholder="Company / organization" value={form.company_name} onChange={event => setForm({ ...form, company_name: event.target.value })} />
                  <Input placeholder="Project name if known" value={form.project_name} onChange={event => setForm({ ...form, project_name: event.target.value })} />
                  <Textarea placeholder="Project details, site address, preferred notes..." value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                  <input type="checkbox" checked={form.sms_consent} onChange={event => setForm({ ...form, sms_consent: event.target.checked })} />
                  I agree to receive SMS updates for this appointment.
                </label>
                <Button type="submit" variant="accent" className="w-full" disabled={loading || !selectedSlot}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Request Appointment
                </Button>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </main>
  );
}
