"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock3, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AppointmentType, BookingSlot } from "@/lib/booking/types";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type BookingStep = 1 | 2 | 3;

export function PublicBookingClient({ appointmentTypes, demoMode, setupMessage }: { appointmentTypes: AppointmentType[]; demoMode: boolean; setupMessage?: string }) {
  const [step, setStep] = React.useState<BookingStep>(1);
  const [selectedTypeId, setSelectedTypeId] = React.useState(appointmentTypes[0]?.id || "");
  const [date, setDate] = React.useState(todayKey());
  const [slots, setSlots] = React.useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = React.useState("");
  const [form, setForm] = React.useState({ first_name: "", last_name: "", email: "", phone: "", company_name: "", project_name: "", notes: "", sms_consent: false });
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(demoMode ? setupMessage || "Demo mode is using sample booking options." : null);
  const [confirmed, setConfirmed] = React.useState(false);
  const selectedType = appointmentTypes.find(type => type.id === selectedTypeId) || appointmentTypes[0];
  const selectedSlotLabel = React.useMemo(() => {
    const slot = slots.find(item => item.start === selectedSlot);
    if (slot) return slot.label;
    if (!selectedSlot) return "";
    return new Date(selectedSlot).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Phoenix" });
  }, [selectedSlot, slots]);
  const detailsComplete = Boolean(form.first_name.trim() && form.last_name.trim() && form.email.trim());

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
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 md:py-12 lg:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-accent">Book Appointment</div>
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
          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { id: 1 as BookingStep, title: "Appointment", text: selectedType?.name || "Choose type", icon: CalendarClock },
                  { id: 2 as BookingStep, title: "Date & Time", text: selectedSlotLabel || "Pick availability", icon: Clock3 },
                  { id: 3 as BookingStep, title: "Your Details", text: detailsComplete ? `${form.first_name} ${form.last_name}` : "Contact info", icon: UserRound }
                ].map(item => {
                  const Icon = item.icon;
                  const complete = item.id === 1 ? Boolean(selectedTypeId) : item.id === 2 ? Boolean(selectedSlot) : detailsComplete;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "rounded-lg border border-border bg-card p-4 text-left transition hover:border-accent",
                        step === item.id && "border-accent bg-accent/10",
                        complete && step !== item.id && "border-success/30"
                      )}
                      onClick={() => {
                        if (item.id === 2 && !selectedTypeId) return;
                        if (item.id === 3 && !selectedSlot) return;
                        setStep(item.id);
                      }}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        Step {item.id}
                      </div>
                      <div className="mt-2 font-medium">{item.title}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{item.text}</div>
                    </button>
                  );
                })}
              </div>

              {step === 1 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Choose Appointment Type</CardTitle>
                    <CardDescription>Select the meeting that best matches what you need.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {appointmentTypes.map(type => (
                      <button
                        key={type.id}
                        type="button"
                        className={cn("rounded-lg border border-border p-4 text-left transition hover:border-accent", selectedTypeId === type.id && "border-accent bg-accent/10")}
                        onClick={() => { setSelectedTypeId(type.id); setSelectedSlot(""); setSlots([]); }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{type.name}</div>
                            <div className="mt-2 text-sm text-muted-foreground">{type.description}</div>
                          </div>
                          {selectedTypeId === type.id ? <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" /> : null}
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">{type.duration_minutes} minutes</div>
                      </button>
                    ))}
                    <div className="flex justify-end pt-2">
                      <Button type="button" variant="accent" disabled={!selectedTypeId} onClick={() => setStep(2)}>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === 2 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Select Date & Time</CardTitle>
                    <CardDescription>Available times are shown in Arizona time.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-[240px_auto]">
                      <Input type="date" value={date} onChange={event => { setDate(event.target.value); setSelectedSlot(""); setSlots([]); }} />
                      <Button type="button" variant="outline" onClick={loadSlots} disabled={loading || !selectedTypeId}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                        Check Availability
                      </Button>
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {slots.map(slot => (
                        <button
                          key={slot.start}
                          type="button"
                          className={cn("rounded-md border border-border px-3 py-3 text-sm transition hover:border-accent", selectedSlot === slot.start ? "border-accent bg-accent text-accent-foreground" : "bg-card")}
                          onClick={() => setSelectedSlot(slot.start)}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                    {!slots.length ? <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Pick a date and check availability to see open appointment times.</div> : null}
                    <div className="mt-5 flex flex-wrap justify-between gap-2">
                      <Button type="button" variant="outline" onClick={() => setStep(1)}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <Button type="button" variant="accent" disabled={!selectedSlot} onClick={() => setStep(3)}>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === 3 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Your Details</CardTitle>
                    <CardDescription>This creates or updates a contact and can prepare client access if needed.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input required placeholder="First name" value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} />
                      <Input required placeholder="Last name" value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} />
                      <Input required type="email" placeholder="Email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
                      <Input placeholder="Phone" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} />
                      <Input placeholder="Company / organization" value={form.company_name} onChange={event => setForm({ ...form, company_name: event.target.value })} />
                      <Input placeholder="Project name if known" value={form.project_name} onChange={event => setForm({ ...form, project_name: event.target.value })} />
                    </div>
                    <Textarea placeholder="Project details, site address, preferred notes..." value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
                    <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                      <input type="checkbox" checked={form.sms_consent} onChange={event => setForm({ ...form, sms_consent: event.target.checked })} />
                      I agree to receive SMS updates for this appointment.
                    </label>
                    <div className="flex flex-wrap justify-between gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setStep(2)}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <Button type="submit" variant="accent" disabled={loading || !selectedSlot || !detailsComplete}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Request Appointment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </section>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle>Booking Summary</CardTitle>
                  <CardDescription>Review your appointment request before sending it to CMI.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <SummaryRow label="Appointment" value={selectedType?.name || "Not selected"} />
                  <SummaryRow label="Duration" value={selectedType ? `${selectedType.duration_minutes} minutes` : "Not selected"} />
                  <SummaryRow label="Date" value={date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not selected"} />
                  <SummaryRow label="Time" value={selectedSlotLabel || "Not selected"} />
                  <SummaryRow label="Contact" value={detailsComplete ? `${form.first_name} ${form.last_name}` : "Add contact details"} />
                  <SummaryRow label="Project" value={form.project_name || "Project name can be added later"} />
                </CardContent>
              </Card>
              <div className="rounded-lg border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
                Requests create a booking record and can connect to contacts, client access, and Project Manager timeline items once Supabase is configured.
              </div>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-48 text-right font-medium">{value}</span>
    </div>
  );
}
