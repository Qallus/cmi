// Read-only view of the Paperclip control plane for the dashboard's
// "Paperclip Agents" tab.
//
// Everything here is a read. Pausing, resuming and approving stay in Paperclip
// until the audit trail on this side exists — the integration plan is explicit
// that auditability comes before control.
//
// Gated by requireBolt: seeing the agent fleet is the same privilege as using
// the agent. Credentials stay server-side; the browser only sees the result.
import { NextResponse } from "next/server";
import { requireBolt, boltErrorResponse } from "@/lib/agent/guard";
import {
  getDashboard, listAgents, listApprovals, listIssues, paperclipBaseUrl,
} from "@/lib/paperclip/client";
import type { PaperclipUnavailable } from "@/lib/paperclip/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireBolt(request);
  } catch (err) {
    return boltErrorResponse(err);
  }

  // One round of calls, all tolerant. A single failing endpoint shows an empty
  // section rather than blanking the tab — an agent key may legitimately be
  // allowed some of these and not others, which is itself worth seeing.
  const [agents, issues, approvals, dashboard] = await Promise.all([
    listAgents(), listIssues(), listApprovals(), getDashboard(),
  ]);

  // If every call failed the same way, that one reason is the whole story.
  const failures = [agents, issues, approvals, dashboard]
    .filter((r): r is { ok: false; unavailable: PaperclipUnavailable } => !r.ok)
    .map((r) => r.unavailable);
  const allFailed = failures.length === 4;

  return NextResponse.json({
    baseUrl: paperclipBaseUrl(),
    unavailable: allFailed ? failures[0] : null,
    agents: agents.ok ? agents.data : [],
    issues: issues.ok ? issues.data : [],
    approvals: approvals.ok ? approvals.data : [],
    dashboard: dashboard.ok ? dashboard.data : null,
    // Per-section reasons, so a partial failure is visible rather than
    // silently rendering as "no agents".
    partial: allFailed ? null : {
      agents: agents.ok ? null : agents.unavailable,
      issues: issues.ok ? null : issues.unavailable,
      approvals: approvals.ok ? null : approvals.unavailable,
      dashboard: dashboard.ok ? null : dashboard.unavailable,
    },
  });
}
