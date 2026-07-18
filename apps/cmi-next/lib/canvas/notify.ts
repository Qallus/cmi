// Team notification when a canvas brief is submitted: email via Resend to the
// configured team list (CANVAS_TEAM_EMAILS, else active admins/PMs), plus an
// optional SMS when CANVAS_TEAM_SMS is set (A2P consent respected via
// isSuppressed). Best-effort — failures never block submission.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isSuppressed } from "@/lib/messaging/consent";
import type { CanvasProject } from "./types";

async function teamEmails(): Promise<string[]> {
  const env = process.env.CANVAS_TEAM_EMAILS;
  if (env) return env.split(",").map((e) => e.trim()).filter(Boolean);
  const { data } = await getSupabaseAdmin()
    .from("staff_users")
    .select("email, role_slug, status")
    .in("role_slug", ["super_admin", "admin", "project_manager"])
    .eq("status", "active");
  return (data ?? []).map((r) => r.email as string).filter(Boolean);
}

export async function notifyBriefSubmitted(canvas: CanvasProject): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://my.constructedmatter.com";
  const link = `${appUrl}/dashboard/canvas-briefs/${canvas.id}`;

  // Email
  try {
    const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
    const from = process.env.RESEND_FROM_EMAIL || "noreply@constructedmatter.com";
    const to = await teamEmails();
    if (key && to.length) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
          <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#c87f3a;font-weight:600">Project Canvas</p>
          <h2 style="font-family:Georgia,serif;font-weight:400;margin:4px 0 10px">A new project brief was submitted</h2>
          <p style="color:#4c463e;font-size:14px;line-height:1.5"><strong>${escapeHtml(canvas.title)}</strong> was sent in by a client through Project Canvas. Open it in the dashboard to review the scenes, annotations, and Bolt read-back.</p>
          <p style="margin:18px 0"><a href="${link}" style="background:#b08427;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:9px;display:inline-block">Review the brief →</a></p>
          <p style="color:#8a8378;font-size:12px">${link}</p>
        </div>`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject: `New Project Canvas brief: ${canvas.title}`, html }),
      }).catch(() => {});
    }
  } catch { /* best-effort */ }

  // Optional SMS
  try {
    const numbers = (process.env.CANVAS_TEAM_SMS || "").split(",").map((n) => n.trim()).filter(Boolean);
    const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, fromNum = process.env.TWILIO_PHONE_NUMBER;
    if (numbers.length && sid && token && fromNum) {
      const creds = Buffer.from(`${sid}:${token}`).toString("base64");
      const bodyText = `New Project Canvas brief: ${canvas.title}. Review: ${link}`;
      for (const to of numbers) {
        if (await isSuppressed("sms", to)) continue;
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: to, From: fromNum, Body: bodyText }).toString(),
        }).catch(() => {});
      }
    }
  } catch { /* best-effort */ }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
