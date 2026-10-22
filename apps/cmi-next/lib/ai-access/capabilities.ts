// What a person may do with — or receive from — CMI's AI (Claude via the MCP
// server today; Paperclip/Hermes agents and AI-generated outreach later).
//
// This list is the single source of truth: Settings → Claude renders a toggle
// per entry and every server check reads it. Adding a capability is one entry
// here plus the place that enforces it — no migration (grants are rows in
// ai_access_grants keyed by `key`).
//
// Receiving AI messages never overrides consent: senders must still check
// isSuppressed() in lib/messaging/consent.ts.
import { BOLT_ROLES } from "@/lib/agent/access";

export type AiSubjectType = "staff" | "contact";

export type AiCapability = {
  key: string;
  label: string;
  description: string;
  appliesTo: AiSubjectType[];
  /** "live" is enforced somewhere today; "planned" shows as Coming soon. */
  status: "live" | "planned";
  /** Staff roles that have it unless someone switches it off for that person. */
  defaultRoles?: readonly string[];
};

export const AI_CAPABILITIES = [
  {
    key: "mcp_connect",
    label: "Connect Claude",
    description: "Can connect their Claude account to the CMI MCP server and use dashboard data from Claude.",
    appliesTo: ["staff"],
    status: "live",
    defaultRoles: BOLT_ROLES,
  },
  {
    key: "company_wide",
    label: "Company-wide access",
    description: "Ownership view: may read any staff member's mailbox, Drive and calendar through Claude, and the executive context.",
    appliesTo: ["staff"],
    status: "live",
  },
  {
    key: "ai_briefing_email",
    label: "Daily briefing email",
    description: "Receives the AI-written daily briefing by email.",
    appliesTo: ["staff"],
    status: "planned",
  },
  {
    key: "ai_exec_summary",
    label: "Executive summary",
    description: "Receives the ownership executive summary.",
    appliesTo: ["staff"],
    status: "planned",
  },
  {
    key: "ai_email",
    label: "AI emails",
    description: "May receive emails written or sent by an AI agent.",
    appliesTo: ["staff", "contact"],
    status: "planned",
  },
  {
    key: "ai_sms",
    label: "AI text messages",
    description: "May receive SMS written or sent by an AI agent.",
    appliesTo: ["staff", "contact"],
    status: "planned",
  },
  {
    key: "ai_dm",
    label: "AI direct messages",
    description: "May receive direct messages (staff DMs or client portal messages) sent by an AI agent.",
    appliesTo: ["staff", "contact"],
    status: "planned",
  },
  {
    key: "ai_notifications",
    label: "AI notifications",
    description: "May receive bell and push notifications triggered by an AI agent.",
    appliesTo: ["staff", "contact"],
    status: "planned",
  },
] as const satisfies readonly AiCapability[];

export type AiCapabilityKey = (typeof AI_CAPABILITIES)[number]["key"];

export function getCapability(key: string): AiCapability | undefined {
  return (AI_CAPABILITIES as readonly AiCapability[]).find((c) => c.key === key);
}

export function isRoleDefault(cap: AiCapability, role: string | null | undefined): boolean {
  return !!role && !!cap.defaultRoles?.includes(role);
}
