"use client";

// The stat cards: one number each, its change since last month, and a
// sparkline where there's a daily series. Call numbers are the shared office
// line, so they're company-wide.
import { CARDS } from "@/lib/dashboard/cards";
import type { CardType } from "@/lib/dashboard/layout";
import type { DashboardData } from "@/lib/dashboard/data";
import { BLUE, BRONZE, bytes, SAGE, Spark, Stat } from "../kit";

const n = (v: number) => v.toLocaleString();
const money = (v: number) => (v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`);

export function StatCard({ type, data }: { type: CardType; data: DashboardData }) {
  const meta = CARDS[type];
  const c = data.calls;
  const comms = "/dashboard/communications?panel=dialer";
  const noCalls = <Stat label={meta.title} icon={meta.icon} value="—" hint="Twilio isn't connected" href="/dashboard/communications" />;
  switch (type) {
    case "stat_calls":
      return c ? <Stat label="Calls this month" icon={meta.icon} value={n(c.total.now)} count={c.total} href={comms}
        chips={[{ label: "In", value: c.inbound.now }, { label: "Out", value: c.outbound.now }, { label: "Missed", value: c.missed.now }]}
        spark={<Spark points={c.series} color={BRONZE} />} /> : noCalls;
    case "stat_outbound":
      return c ? <Stat label="Outbound" icon={meta.icon} value={n(c.outbound.now)} count={c.outbound} href={comms} spark={<Spark points={c.series} field="b" color={SAGE} />} /> : noCalls;
    case "stat_inbound":
      return c ? <Stat label="Inbound" icon={meta.icon} value={n(c.inbound.now)} count={c.inbound} href={comms} spark={<Spark points={c.series} color={BLUE} />} /> : noCalls;
    case "stat_missed":
      return c ? <Stat label="Missed" icon={meta.icon} value={n(c.missed.now)} count={c.missed} href={comms} tone={c.missed.now ? "warn" : undefined} /> : noCalls;
    case "stat_sms": {
      const t = data.texts;
      if (!t) return <Stat label="SMS" icon={meta.icon} value="—" hint="Couldn't load texts" href="/dashboard/communications?tab=sms" />;
      return <Stat label="Texts this month" icon={meta.icon} value={n(t.sent.now + t.received.now)}
        count={{ now: t.sent.now + t.received.now, last: t.sent.last + t.received.last }} href="/dashboard/communications?tab=sms"
        chips={[{ label: "Sent", value: t.sent.now }, { label: "Got", value: t.received.now }]} spark={<Spark points={t.series} color={SAGE} />} />;
    }
    case "stat_emails":
      return <Stat label="Emails sent" icon={meta.icon} value={data.emails ? n(data.emails.now) : "—"} count={data.emails} href="/dashboard/communications?tab=email" />;
    case "stat_bookings":
      return <Stat label="Bookings this month" icon={meta.icon} value={data.bookings ? n(data.bookings.now) : "—"} count={data.bookings} href="/dashboard/bookings" />;
    case "stat_calendar":
      return <Stat label="Next 7 days" icon={meta.icon} value={n(data.calendar.week)} hint="your meetings and bookings" href="/dashboard/today" />;
    case "stat_notifications": {
      const u = data.notifications?.unread ?? 0;
      return <Stat label="Notifications" icon={meta.icon} value={data.notifications ? n(u) : "—"} hint={u ? "Unread" : "All caught up"} />;
    }
    case "stat_messages":
      return <Stat label="Unread messages" icon={meta.icon} value={data.messages ? n(data.messages.unread) : "—"} hint="Direct messages" href="/dashboard/direct-messages" />;
    case "stat_alerts": {
      const a = data.alerts?.length ?? 0;
      return <Stat label="Alerts" icon={meta.icon} value={data.alerts ? n(a) : "—"} hint={a ? "Need your attention" : "Nothing needs you"} href="/dashboard/today" tone={a ? "warn" : undefined} />;
    }
    case "stat_files":
      return data.files
        ? <Stat label="Cloud files" icon={meta.icon} value={n(data.files.count)} href="/dashboard/cloud"
            chips={[{ label: "Used", value: bytes(data.files.bytes) }, { label: "Mine this week", value: data.files.mine }]} />
        : <Stat label="Cloud files" icon={meta.icon} value="—" href="/dashboard/cloud" />;
    case "stat_jobs": {
      const j = data.jobs;
      return <Stat label="Jobs" icon={meta.icon} value={j ? n(j.total) : "—"} href="/dashboard/jobs" hint={j ? undefined : "Couldn't load"}
        chips={(j?.byStatus ?? []).slice(0, 3).map((s) => ({ label: s.name, value: s.value }))} />;
    }
    case "stat_pipeline": {
      const p = data.pipeline;
      return <Stat label="Open deals" icon={meta.icon} value={p ? n(p.open) : "—"} href="/dashboard/pipeline"
        chips={p ? [{ label: "Value", value: money(p.value) }] : []} />;
    }
    case "stat_precon":
      return <Stat label="In Pre-Con" icon={meta.icon} value={data.precon == null ? "—" : n(data.precon)} href="/dashboard/sales" />;
    case "stat_punch":
      return <Stat label="Punch items for you" icon={meta.icon} value={data.punch == null ? "—" : n(data.punch)} href="/dashboard/punch-lists" tone={data.punch ? "warn" : undefined} />;
    case "stat_daily_logs":
      return <Stat label="Daily logs this week" icon={meta.icon} value={data.dailyLogs == null ? "—" : n(data.dailyLogs)} href="/dashboard/daily-logs" />;
    case "stat_contacts":
      return <Stat label="New leads" icon={meta.icon} value={data.leads ? n(data.leads.now) : "—"} count={data.leads} href="/dashboard/contacts?tab=Lead" />;
    default:
      return null;
  }
}
