import type { AppointmentType, AvailabilityRule, BookingSlot } from "./types";

const PHOENIX_OFFSET = "-07:00";
const SLOT_STEP_MINUTES = 15;

export type BusyWindow = {
  start_time: string;
  end_time: string;
};

export function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizePhone(value: unknown) {
  return cleanText(value).replace(/[^\d+]/g, "");
}

export function parseDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function dateKeyForPhoenix(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function dateTimeToDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return dateKeyForPhoenix(date);
}

export function phoenixDateTimeToIso(dateKey: string, time: string) {
  const [hour = "00", minute = "00"] = time.split(":");
  return new Date(`${dateKey}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00${PHOENIX_OFFSET}`).toISOString();
}

function dayOfWeekForPhoenix(dateKey: string) {
  return new Date(`${dateKey}T12:00:00${PHOENIX_OFFSET}`).getUTCDay();
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function timeFromMinutes(value: number) {
  const minutes = Math.max(0, Math.min(24 * 60, value));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

export function formatPhoenixDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatPhoenixTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function buildAvailabilitySlots(input: {
  appointmentType: AppointmentType;
  dateKey: string;
  rules: AvailabilityRule[];
  appointments: BusyWindow[];
  blockedTimes: BusyWindow[];
  now?: Date;
}): BookingSlot[] {
  const { appointmentType, dateKey, rules, appointments, blockedTimes } = input;
  const now = input.now ?? new Date();
  const todayKey = dateKeyForPhoenix(now);
  const maxDate = new Date(`${todayKey}T12:00:00${PHOENIX_OFFSET}`);
  maxDate.setUTCDate(maxDate.getUTCDate() + Number(appointmentType.max_days_in_advance || 60));

  const selectedDate = new Date(`${dateKey}T12:00:00${PHOENIX_OFFSET}`);
  if (selectedDate > maxDate) return [];

  const minStart = new Date(now.getTime() + Number(appointmentType.min_notice_minutes || 0) * 60 * 1000);
  const duration = Number(appointmentType.duration_minutes || 30);
  const bufferBefore = Number(appointmentType.buffer_before_minutes || 0);
  const bufferAfter = Number(appointmentType.buffer_after_minutes || 0);
  const weekday = dayOfWeekForPhoenix(dateKey);
  const activeRules = rules.filter(rule => rule.is_available && rule.day_of_week === weekday);

  const busyWindows = [...appointments, ...blockedTimes].map(item => ({
    start: new Date(item.start_time),
    end: new Date(item.end_time)
  }));

  const slots: BookingSlot[] = [];
  for (const rule of activeRules) {
    const firstMinute = minutesFromTime(rule.start_time);
    const lastMinute = minutesFromTime(rule.end_time);
    for (let minute = firstMinute; minute + duration <= lastMinute; minute += SLOT_STEP_MINUTES) {
      const start = new Date(phoenixDateTimeToIso(dateKey, timeFromMinutes(minute)));
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const guardedStart = new Date(start.getTime() - bufferBefore * 60 * 1000);
      const guardedEnd = new Date(end.getTime() + bufferAfter * 60 * 1000);
      const conflicts = busyWindows.some(busy => rangesOverlap(guardedStart, guardedEnd, busy.start, busy.end));

      if (start < minStart || conflicts) continue;
      slots.push({ start: start.toISOString(), end: end.toISOString(), label: formatPhoenixTime(start) });
    }
  }

  return slots;
}

export function makeBookingTitle(typeName: string, firstName: string, lastName: string) {
  const customer = [firstName, lastName].filter(Boolean).join(" ").trim();
  return customer ? `${typeName}: ${customer}` : typeName;
}
