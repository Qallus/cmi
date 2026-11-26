"use client";

// List cards: notifications, next up, AI agent alerts, job alerts, My Tasks
// (one sliding row, 3½ cards across), recent files, Paperclip agents and
// schedules that need a look.
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, CircleDot, Clock, FileText, HardHat, ListChecks } from "lucide-react";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData } from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";
import { ago, bytes, Empty, Frame, Unavailable } from "../kit";
import { SlideRow } from "../slide-row";

export function NotificationsCard({ data }: { data: DashboardData }) {
  const meta = CARDS.notifications;
  const n = data.notifications;
  if (!n) return <Unavailable title={meta.title} icon={meta.icon} />;
  return (
    <Frame title={`Notifications${n.unread ? ` · ${n.unread}` : ""}`} icon={meta.icon}>
      {!n.items.length ? <Empty>You&apos;re all caught up.</Empty> : (
        <ul className="-mx-1 space-y-0.5">
          {n.items.slice(0, 4).map((x) => (
            <li key={x.id}>
              <Link href={x.href} className="flex w-full gap-2.5 rounded-lg px-1 py-1.5 hover:bg-muted/60">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{x.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{x.subtitle ? `${x.subtitle} · ` : ""}{ago(x.time)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

export function NextUpCard({ data }: { data: DashboardData }) {
  const meta = CARDS.next_up;
  const x = data.nextUp;
  return (
    <Frame title="Next up" icon={meta.icon} href="/dashboard/today">
      {!x ? <Empty>Nothing scheduled. Enjoy the quiet.</Empty> : (
        <Link href={x.href} className="flex h-full flex-col justify-center rounded-xl bg-gradient-to-br from-accent/10 to-transparent p-3 hover:from-accent/15">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent"><Clock className="size-3.5" />{x.when}</span>
          <span className="mt-1 line-clamp-2 text-base font-semibold leading-snug">{x.title}</span>
          {x.detail ? <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{x.detail}</span> : null}
        </Link>
      )}
    </Frame>
  );
}

export function AgentAlertCard({ data }: { data: DashboardData }) {
  const meta = CARDS.agent_alert;
  const a = data.agents;
  if (!a) return <Unavailable title={meta.title} icon={meta.icon} />;
  const items = [...a.approvals.map((x) => ({ ...x, kind: "Approval" })), ...a.issues.map((x) => ({ ...x, kind: "Issue" }))].slice(0, 4);
  return (
    <Frame title="AI agents" icon={Bot} href="/dashboard/agent">
      {!a.configured ? <Empty action={<Link href="/dashboard/agent" className="text-xs underline">Ask Bolt instead</Link>}>Paperclip isn&apos;t connected yet.</Empty>
        : !items.length ? <Empty><CheckCircle2 className="mx-auto mb-1 size-5 text-emerald-600" />No approvals or open issues.</Empty> : (
          <ul className="space-y-1.5">
            {items.map((x, i) => (
              <li key={i}>
                <Link href={x.href} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-muted/60">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", x.kind === "Approval" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground")}>{x.kind}</span>
                  <span className="min-w-0 flex-1 truncate">{x.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </Frame>
  );
}

export function JobAlertCard({ data }: { data: DashboardData }) {
  const meta = CARDS.job_alert;
  const list = data.jobAlerts;
  if (!list) return <Unavailable title={meta.title} icon={meta.icon} />;
  return (
    <Frame title="Job alerts" icon={HardHat} href="/dashboard/schedules">
      {!list.length ? <Empty><CheckCircle2 className="mx-auto mb-1 size-5 text-emerald-600" />Every schedule is on track.</Empty> : (
        <ul className="space-y-1.5">
          {list.slice(0, 4).map((s) => (
            <li key={s.scheduleId}>
              <Link href={`/dashboard/jobs/${s.jobId}/schedule`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-muted/60">
                <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.jobLabel}</span><span className="block truncate text-xs text-muted-foreground">{s.scheduleName}</span></span>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">{s.issues}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

export function SchedulesLookCard({ data }: { data: DashboardData }) {
  return <JobAlertCard data={data} />;
}

const BUCKET = {
  overdue: { label: "Overdue", cls: "text-red-600 bg-red-500/10" },
  today: { label: "Today", cls: "text-accent bg-accent/10" },
  week: { label: "This week", cls: "text-muted-foreground bg-muted" },
} as const;

/** Your due tasks, one sliding row with about 3½ cards across. */
export function MyTasksCard({ data }: { data: DashboardData }) {
  const tasks = data.tasks;
  if (!tasks) return <Unavailable title="My Tasks" icon={ListChecks} />;
  if (!tasks.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        <CheckCircle2 className="size-5 text-emerald-600" /> Nothing due this week. <Link href="/dashboard/today" className="ml-auto text-xs underline">Open Today</Link>
      </div>
    );
  }
  return (
    <SlideRow label="My Tasks">
      {tasks.map((t, i) => {
        const b = BUCKET[t.bucket];
        return (
          <Link key={`${t.href}-${i}`} href={t.href}
            className="flex min-h-[7.5rem] w-[78%] shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[calc((100%-1.5rem)/2.5)] lg:w-[calc((100%-2.25rem)/3.5)]">
            <span className="flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", b.cls)}>{b.label}</span>
              {t.tag ? <span className="truncate text-xs text-muted-foreground">{t.tag}</span> : null}
            </span>
            <span className="mt-2 line-clamp-2 font-medium leading-snug">{t.title}</span>
            {t.detail ? <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.detail}</span> : null}
            <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs text-muted-foreground"><CircleDot className="size-3" /> Open</span>
          </Link>
        );
      })}
    </SlideRow>
  );
}

export function RecentFilesCard({ data }: { data: DashboardData }) {
  const meta = CARDS.recent_files;
  const files = data.recentFiles;
  if (!files) return <Unavailable title={meta.title} icon={meta.icon} />;
  return (
    <Frame title={meta.title} icon={meta.icon} href="/dashboard/cloud">
      {!files.length ? <Empty>No files yet.</Empty> : (
        <ul className="space-y-1">
          {files.slice(0, 6).map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{f.size_bytes ? bytes(f.size_bytes) : ""} · {ago(f.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

export function PaperclipAgentsCard({ data }: { data: DashboardData }) {
  const meta = CARDS.paperclip_agents;
  const a = data.agents;
  if (!a) return <Unavailable title={meta.title} icon={meta.icon} />;
  return (
    <Frame title={meta.title} icon={meta.icon} href="/dashboard/agent">
      {!a.configured ? <Empty>Paperclip isn&apos;t connected yet.</Empty> : !a.agents.length ? <Empty>No agents yet.</Empty> : (
        <>
          <div className="mb-2 flex gap-2 text-xs">
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">{a.approvals.length} approvals</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{a.issues.length} open issues</span>
          </div>
          <ul className="space-y-1">
            {a.agents.map((x, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={cn("size-2 rounded-full", /active|running|idle|online/i.test(x.status) ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                <span className="min-w-0 flex-1 truncate">{x.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{x.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Frame>
  );
}

