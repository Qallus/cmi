// Inspection settings that people edit: each jurisdiction's next-day cutoff,
// who may edit the jurisdiction list, and who may update an inspection's status.
// Pure (no I/O), shared by the dashboard, the API and the CMI MCP tools.

// ── Cutoff time ─────────────────────────────────────────────────────────────
// Stored as minutes after midnight on the business day before the inspection
// (inspection_jurisdictions.cutoff_minutes); 1440 = midnight, null = not published.

/** "15:30", "3:30 PM", "3 pm", "midnight", "" → minutes, null (none), or undefined (can't read it). */
export function parseCutoffTime(input: string | null | undefined): number | null | undefined {
  const t = (input ?? "").trim().toLowerCase();
  if (!t || t === "none" || t === "not published" || t === "unknown") return null;
  if (t === "midnight" || t === "24:00" || t === "12:00 am" || t === "12 am") return 1440;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.exec(t);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.replace(/\./g, "");
  if (min > 59) return undefined;
  if (ap) {
    if (h < 1 || h > 12) return undefined;
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
  } else if (h > 23) return undefined;
  const total = h * 60 + min;
  return total === 0 ? 1440 : total; // 00:00 means the end of that day
}

/** Minutes → "3:30 PM" / "Midnight"; null → "". */
export function formatCutoff(minutes: number | null | undefined): string {
  if (minutes == null) return "";
  if (minutes >= 1440 || minutes === 0) return "Midnight";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Minutes → "15:30" for an <input type="time">; midnight shows as 23:59 there, so callers offer a Midnight choice. */
export function cutoffToTimeInput(minutes: number | null | undefined): string {
  if (minutes == null || minutes >= 1440) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The default label for a cutoff: "3:30 PM the business day before" or "Not published (confirm)". */
export function defaultCutoffLabel(minutes: number | null | undefined): string {
  return minutes == null ? "Not published (confirm with the jurisdiction)" : `${formatCutoff(minutes)} the business day before`;
}

/** A jurisdiction code: 2–6 capital letters, the prefix of its milestone IDs (SCOT, PHX, MCO). */
export function isJurisdictionCode(code: string): boolean {
  return /^[A-Z]{2,6}$/.test(code.trim());
}

// ── Who may do what ─────────────────────────────────────────────────────────

/** Roles that may always update an inspection's status, whatever the setting says. */
export const ALWAYS_STATUS_ROLES = ["super_admin", "admin"] as const;

/** Roles a Super Admin can allow to update inspection status. */
export const STATUS_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "project_manager", label: "Project Managers" },
  { value: "superintendent", label: "Superintendents" },
  { value: "estimator", label: "Estimators" },
  { value: "designer", label: "Designers" },
  { value: "staff", label: "Staff" },
];

/** The default: both Project Managers and Superintendents (Brandon, Nov 11, 2026). */
export const DEFAULT_STATUS_ROLES = ["project_manager", "superintendent"];

/** Keep only known, allowable roles, in option order. */
export function cleanStatusRoles(input: unknown): string[] {
  const set = new Set(Array.isArray(input) ? input.map(String) : []);
  return STATUS_ROLE_OPTIONS.map((o) => o.value).filter((v) => set.has(v));
}

export function canUpdateInspectionStatus(role: string | null | undefined, allowedRoles: string[]): boolean {
  if (!role) return false;
  return (ALWAYS_STATUS_ROLES as readonly string[]).includes(role) || allowedRoles.includes(role);
}

/** Who may edit the jurisdiction list (names, how to request, cutoffs). */
export function canEditJurisdictions(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

/** Who may change who updates inspection status. */
export function canEditInspectionSettings(role: string | null | undefined): boolean {
  return role === "super_admin";
}
