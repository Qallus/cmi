"use client";

import * as React from "react";
import { Diamond } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ITEM_STATUS_LABELS, ITEM_STATUS_TONE, HEALTH_LABELS, HEALTH_TONE,
  SCHEDULE_TYPE_LABELS, PRIORITY_LABELS,
  type ItemStatus, type ScheduleHealth, type ScheduleType, type SchedulePriority, type ScheduleView,
} from "@/lib/schedules/types";
import { LayoutList, Table2, LayoutGrid, CalendarRange, BarChart3, GanttChartSquare, Columns3, Users } from "lucide-react";

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
}
export function fmtShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

export function StatusChip({ status }: { status: ItemStatus }) {
  return <Badge tone={ITEM_STATUS_TONE[status] ?? "default"}>{ITEM_STATUS_LABELS[status] ?? status}</Badge>;
}
export function HealthChip({ health }: { health: ScheduleHealth }) {
  return <Badge tone={HEALTH_TONE[health] ?? "default"}>{HEALTH_LABELS[health] ?? health}</Badge>;
}
export function TypeBadge({ type }: { type: ScheduleType }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{SCHEDULE_TYPE_LABELS[type] ?? type}</span>;
}

const PRIORITY_DOT: Record<SchedulePriority, string> = {
  low: "bg-muted-foreground/40", normal: "bg-info", high: "bg-warning", urgent: "bg-orange-500", critical: "bg-destructive",
};
export function PriorityDot({ priority }: { priority: SchedulePriority }) {
  return <span title={PRIORITY_LABELS[priority]} className={cn("inline-block h-2 w-2 rounded-full", PRIORITY_DOT[priority] ?? "bg-muted-foreground/40")} />;
}

export function MilestoneMark({ className }: { className?: string }) {
  return <Diamond className={cn("h-3.5 w-3.5 fill-accent text-accent", className)} />;
}

export const VIEWS: { key: ScheduleView; label: string; icon: typeof LayoutList }[] = [
  { key: "gantt", label: "Gantt", icon: GanttChartSquare },
  { key: "list", label: "List", icon: LayoutList },
  { key: "table", label: "Table", icon: Table2 },
  { key: "calendar", label: "Calendar", icon: CalendarRange },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "timeline", label: "Timeline", icon: BarChart3 },
  { key: "card", label: "Cards", icon: LayoutGrid },
  { key: "resource", label: "Resource", icon: Users },
];

// A stable-ish color for a schedule when none is set (brand-stepped).
const SCHED_COLORS = ["#9e6f2e", "#9B2F2E", "#3f3a34", "#B58F55", "#5b7a8c", "#7c6f5a", "#2f6f5e", "#8a6d3f"];
export function scheduleColor(id: string, explicit?: string | null): string {
  if (explicit) return explicit;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return SCHED_COLORS[h % SCHED_COLORS.length];
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}
