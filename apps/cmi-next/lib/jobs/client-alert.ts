// Who hears about something a client did on a job (a selection comment, a
// message, a warranty request...). Pure, so the rule is tested.
//
//   1. the job's team roster members who have Notifications ticked
//   2. the job's PM, even with their box unticked: a client spoke and the PM
//      owns the relationship. The PM is the roster row with the Project
//      Manager role, and/or the staff user named in the free-text jobs.project_manager
//      ("Name — email · phone"), matched by email first, then by name.
//   3. nobody yet? Admins and Super Admins, so a client is never unheard.

export type AlertStaff = { id: string; display_name: string | null; email: string | null; role_slug: string | null; status?: string | null };
export type AlertRosterRow = { staff_user_id: string | null; role: string | null; notifications_enabled: boolean | null };

import { jobTeamRole } from "./team-roles.ts";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9@.]+/g, " ").replace(/\s+/g, " ").trim();

/** The email and name in a free-text PM field ("Ben Smith — ben@x.com · 602…"). */
export function parsePmField(text: string | null | undefined): { email: string | null; name: string | null } {
  const t = (text ?? "").trim();
  if (!t) return { email: null, name: null };
  const email = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? null;
  const name = t.split(/\s[—–-]\s|·|,|\(|<|\|/)[0].replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "").trim() || null;
  return { email, name };
}

/** The staff user a free-text PM field names, if any. */
export function matchPmStaff(text: string | null | undefined, staff: AlertStaff[]): AlertStaff | null {
  const { email, name } = parsePmField(text);
  const live = staff.filter((s) => (s.status ?? "active") === "active");
  if (email) {
    const byEmail = live.find((s) => (s.email ?? "").toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  if (name) {
    const n = norm(name);
    const exact = live.filter((s) => norm(s.display_name ?? "") === n);
    if (exact.length === 1) return exact[0];
    // "Ben" alone or "Ben S." — only when it picks out one person.
    const first = n.split(" ")[0];
    const loose = live.filter((s) => { const d = norm(s.display_name ?? ""); return first.length > 1 && (d === first || d.startsWith(`${first} `)); });
    if (loose.length === 1 && n.split(" ").length === 1) return loose[0];
  }
  return null;
}

export type AlertPlan = { ids: string[]; pmIds: string[]; fallback: boolean };

export function clientAlertPlan(roster: AlertRosterRow[], pmField: string | null | undefined, staff: AlertStaff[]): AlertPlan {
  const ids = new Set<string>();
  const pmIds = new Set<string>();
  for (const r of roster) if (r.staff_user_id && r.notifications_enabled) ids.add(r.staff_user_id);
  for (const r of roster) if (r.staff_user_id && jobTeamRole(r.role) === "Project Manager") pmIds.add(r.staff_user_id);
  const named = matchPmStaff(pmField, staff);
  if (named) pmIds.add(named.id);
  for (const id of pmIds) ids.add(id);
  if (ids.size) return { ids: [...ids], pmIds: [...pmIds], fallback: false };
  const admins = staff.filter((s) => (s.status ?? "active") === "active" && (s.role_slug === "super_admin" || s.role_slug === "admin")).map((s) => s.id);
  return { ids: admins, pmIds: [], fallback: true };
}
