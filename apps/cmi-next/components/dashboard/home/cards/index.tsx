"use client";

import type { DashboardData } from "@/lib/dashboard/data";
import type { Card } from "@/lib/dashboard/layout";
import { ChartCard } from "./charts";
import { CompanyCountsCard, QuickActionsCard, RecentActivityCard, RevenueOutlookSlot } from "./company";
import { GetStartedCard, WhatsNewCard } from "./info";
import { AgentAlertCard, JobAlertCard, MyTasksCard, NextUpCard, NotificationsCard, PaperclipAgentsCard, RecentFilesCard, SchedulesLookCard } from "./lists";
import { MiniCalendarCard, UpcomingCard } from "./schedule";
import { StatCard } from "./stats";
import { AdminShortcutsCard, AllFeaturesCard, AskBoltCard, ClockCard, DialpadCard, NotepadCard, QuickLinksCard, RecorderCard, SearchCard, TaskListCard } from "./tools";
import { WeatherCard } from "./weather";

export type CardCtx = {
  data: DashboardData;
  set: (patch: Record<string, unknown>) => void;
  openFeatures: () => void;
  customize: () => void;
  /** The first dialpad on the page (only one may ring). */
  firstDialpadId: string | null;
  /** Server-rendered pieces (the admin Revenue Outlook). */
  slots: { outlook?: React.ReactNode };
};

// One card type -> its component.
export function RenderCard({ card, ctx }: { card: Card; ctx: CardCtx }) {
  const { data, set } = ctx;
  const s = card.settings;
  switch (card.type) {
    case "get_started": return <GetStartedCard settings={s} set={set} openFeatures={ctx.openFeatures} customize={ctx.customize} />;
    case "whats_new": return <WhatsNewCard data={data} settings={s} set={set} />;
    case "search": return <SearchCard />;
    case "all_features": return <AllFeaturesCard open={ctx.openFeatures} />;
    case "clock": return <ClockCard />;
    case "weather": return <WeatherCard />;
    case "dialpad": return <DialpadCard first={ctx.firstDialpadId === card.id} />;
    case "recorder": return <RecorderCard />;
    case "notepad": return <NotepadCard settings={s} set={set} />;
    case "task_list": return <TaskListCard settings={s} set={set} />;
    case "ask_bolt": return <AskBoltCard />;
    case "quick_links": return <QuickLinksCard data={data} />;
    case "admin_shortcuts": return <AdminShortcutsCard />;
    case "notifications": return <NotificationsCard data={data} />;
    case "next_up": return <NextUpCard data={data} />;
    case "agent_alert": return <AgentAlertCard data={data} />;
    case "job_alert": return <JobAlertCard data={data} />;
    case "schedules_look": return <SchedulesLookCard data={data} />;
    case "my_tasks": return <MyTasksCard data={data} />;
    case "recent_files": return <RecentFilesCard data={data} />;
    case "paperclip_agents": return <PaperclipAgentsCard data={data} />;
    case "mini_calendar": return <MiniCalendarCard data={data} />;
    case "upcoming": return <UpcomingCard data={data} />;
    case "company_counts": return <CompanyCountsCard data={data} />;
    case "recent_activity": return <RecentActivityCard data={data} />;
    case "quick_actions": return <QuickActionsCard />;
    case "revenue_outlook": return <RevenueOutlookSlot slot={ctx.slots.outlook} />;
    case "chart_calls": case "chart_texts": case "chart_pipeline": case "chart_jobs": return <ChartCard type={card.type} data={data} />;
    default: return <StatCard type={card.type} data={data} />;
  }
}
