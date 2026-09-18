import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function dateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string | Date, days: number) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
  date.setDate(date.getDate() + days);
  return dateOnly(date);
}

export function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function initials(value?: string | null) {
  return String(value || "CM")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "CM";
}

// Whole-dollar currency ("$12,345"); compact form for dense grids ("$12.3k", "$1.2M").
export function formatMoney(value: number | null | undefined, opts?: { compact?: boolean }) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (opts?.compact && abs >= 1000) {
    const [n, suffix] = abs >= 1_000_000 ? [abs / 1_000_000, "M"] : [abs / 1000, "k"];
    return `${sign}$${n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "")}${suffix}`;
  }
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}
