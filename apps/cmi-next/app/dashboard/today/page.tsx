import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, CheckSquare, Inbox, History, Sparkles } from "lucide-react";
import { getSessionStaff } from "@/lib/auth/server-session";
import { buildBriefing, briefingCounts, type Briefing, type BriefingItem, type BriefingUpdate } from "@/lib/briefing/build";
import { briefingSummary } from "@/lib/briefing/summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "Today — CMI Dashboard" };
export const dynamic = "force-dynamic";

// The on-screen twin of the 6 AM briefing email: the same data, always current.
export default async function TodayPage() {
  const staff = await getSessionStaff();
  if (!staff) return null;
  const briefing = await buildBriefing({ id: staff.id, email: staff.email, display_name: staff.display_name, role_slug: staff.role_slug });
  const c = briefingCounts(briefing);
  const t = briefing.tasks;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{briefing.dateLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold">Good morning, {briefing.staff.firstName}</h1>
      </div>

      {/* The AI summary streams in after the cards, so a slow model never holds up the page. */}
      <Card className="border-l-4 border-l-accent bg-accent/5">
        <CardContent className="p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Here&apos;s what needs you today
          </p>
          <Suspense fallback={<p className="mt-2 animate-pulse text-sm text-muted-foreground">Bolt is reading your day…</p>}>
            <Summary briefing={briefing} />
          </Suspense>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Meetings" value={c.meetings} />
        <Stat label="Overdue" value={c.overdue} alert />
        <Stat label="Due today" value={c.dueToday} />
        <Stat label="Waiting on you" value={c.attention} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={CalendarClock} title="Today's meetings" count={c.meetings}>
          <Rows items={briefing.meetings} empty="No meetings or bookings on your calendar today." />
        </Section>

        <Section icon={CheckSquare} title="Your tasks" count={c.overdue + c.dueToday + c.dueWeek}>
          {!t.overdue.length && !t.today.length && !t.week.length ? (
            <p className="text-sm text-muted-foreground">Nothing due this week.</p>
          ) : (
            <div className="space-y-3">
              {t.overdue.length > 0 && <Group label="Overdue" className="text-destructive"><Rows items={t.overdue} /></Group>}
              {t.today.length > 0 && <Group label="Due today" className="text-accent"><Rows items={t.today} /></Group>}
              {t.week.length > 0 && <Group label="Later this week" className="text-muted-foreground"><Rows items={t.week} /></Group>}
            </div>
          )}
          {t.undated > 0 && <p className="mt-3 text-xs text-muted-foreground">Plus {t.undated} open task{t.undated === 1 ? "" : "s"} with no due date.</p>}
        </Section>

        <Section icon={Inbox} title="Waiting on you" count={c.attention}>
          <Rows items={briefing.attention} empty="Nothing waiting on a reply." />
        </Section>

        <Section icon={History} title="Since yesterday" count={c.updates}>
          <Updates updates={briefing.updates} />
        </Section>
      </div>
    </div>
  );
}

async function Summary({ briefing }: { briefing: Briefing }) {
  const { text } = await briefingSummary(briefing);
  return <p className="mt-2 text-[15px] leading-relaxed">{text}</p>;
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <Card className="p-4 text-center">
      <div className={cn("text-3xl font-bold leading-none", alert && value > 0 && "text-destructive")}>{value}</div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
    </Card>
  );
}

function Section({ icon: Icon, title, count, children }: { icon: typeof Inbox; title: string; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]"><Icon className="h-4 w-4 text-accent" /> {title}</CardTitle>
        <Badge>{count}</Badge>
      </CardHeader>
      <CardContent className="pt-3">{children}</CardContent>
    </Card>
  );
}

function Group({ label, className, children }: { label: string; className: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={cn("mb-1 text-[11px] font-bold uppercase tracking-[0.1em]", className)}>{label}</p>
      {children}
    </div>
  );
}

const TONE: Record<NonNullable<BriefingItem["tone"]>, string> = {
  danger: "text-destructive",
  warn: "text-accent",
  default: "text-muted-foreground",
};

function Rows({ items, empty }: { items: BriefingItem[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((it, i) => (
        <li key={`${it.href}-${i}`}>
          <Link href={it.href} className="-mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted">
            <span className="min-w-0">
              <span className="block text-sm font-medium">{it.title}</span>
              {it.detail && <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>}
            </span>
            {it.tag && <span className={cn("shrink-0 text-xs font-semibold", TONE[it.tone ?? "default"])}>{it.tag}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Updates({ updates }: { updates: BriefingUpdate[] }) {
  if (!updates.length) return <p className="text-sm text-muted-foreground">No changes from the team on your jobs or deals since yesterday.</p>;
  return (
    <ul className="divide-y divide-border">
      {updates.map((u) => (
        <li key={u.href} className="py-2.5">
          <Link href={u.href} className="text-sm font-medium hover:underline">{u.title}</Link>
          {u.subtitle && <span className="text-xs text-muted-foreground"> · {u.subtitle}</span>}
          <ul className="mt-1 space-y-1">
            {u.lines.map((l, i) => <li key={i} className="border-l-2 border-border pl-2.5 text-xs text-muted-foreground">{l}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}
