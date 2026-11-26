// Who can use which dashboard card. Mirrors the sidebar (components/dashboard/
// nav.tsx): a card only shows for someone who can open the page it summarises.
// Pure, so the page, the save route and the tests agree.
import type { CardType } from "./layout.ts";

export const DASHBOARD_FLAG = "dashboard_v2";

const COMMS = ["super_admin", "admin", "project_manager", "estimator"];
const SALES = ["super_admin", "admin", "project_manager", "estimator"];
const JOBS = ["super_admin", "admin", "project_manager", "estimator", "superintendent", "designer"];
const SCHEDULES = ["super_admin", "admin", "project_manager", "superintendent", "estimator", "designer", "staff"];
const PUNCH = ["super_admin", "admin", "project_manager", "estimator", "superintendent", "designer", "staff"];
const CLOUD = ["super_admin", "admin", "project_manager", "estimator", "superintendent", "designer", "staff"];
const BOOKINGS = ["super_admin", "admin", "project_manager", "estimator"];
const AI = ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent"];
const ADMIN = ["super_admin", "admin"];

const RULES: Partial<Record<CardType, { roles?: string[]; flag?: string }>> = {
  stat_calls: { roles: COMMS }, stat_outbound: { roles: COMMS }, stat_inbound: { roles: COMMS }, stat_missed: { roles: COMMS },
  stat_sms: { roles: COMMS }, stat_emails: { roles: COMMS }, dialpad: { roles: COMMS }, chart_calls: { roles: COMMS }, chart_texts: { roles: COMMS },
  stat_pipeline: { roles: SALES }, stat_precon: { roles: SALES }, chart_pipeline: { roles: SALES }, stat_contacts: { roles: SALES },
  stat_jobs: { roles: JOBS }, chart_jobs: { roles: JOBS }, stat_daily_logs: { roles: JOBS }, job_alert: { roles: JOBS },
  schedules_look: { roles: SCHEDULES },
  stat_punch: { roles: PUNCH },
  stat_files: { roles: CLOUD }, recent_files: { roles: CLOUD },
  stat_bookings: { roles: BOOKINGS },
  ask_bolt: { roles: AI }, agent_alert: { roles: AI }, paperclip_agents: { roles: AI },
  revenue_outlook: { roles: ADMIN, flag: "projections" },
  admin_shortcuts: { roles: ADMIN },
};

/** Can this role (with these flags on) use this card? */
export function cardAllowed(type: CardType, role: string | null | undefined, flags: Record<string, boolean> = {}): boolean {
  const rule = RULES[type];
  if (!rule) return true;
  if (rule.roles && !rule.roles.includes(role ?? "")) return false;
  if (rule.flag && flags[rule.flag] !== true) return false;
  return true;
}

/** Can this role change the company default dashboard? */
export const canSetDashboardDefault = (role: string | null | undefined) => role === "super_admin";
/** Can this role write What's New entries? */
export const canManageWhatsNew = (role: string | null | undefined) => role === "super_admin" || role === "admin";
