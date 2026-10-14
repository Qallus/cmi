// Recipients, sending and history for executive summaries. Server only.
//
// Guard rails: a TEAM summary (budget, internal notes, risks) can only go to
// active CMI staff — never a typed-in address. A CLIENT summary can only go to
// the client contacts on that Job / Pre-Con record (plus any extra addresses
// the sender types, since its content is client-safe), and only roles that
// talk to clients may send it.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { sendEmail } from "@/lib/messaging/send";
import { isSuppressed } from "@/lib/messaging/consent";
import { publicAppUrl } from "@/lib/twilio";
import { createJobUpdate } from "@/lib/job-updates/data";
import { htmlToText } from "@/lib/notes/html";
import { sanitizeHtmlServer } from "@/lib/html/sanitize-server";
import { summaryDocumentHtml } from "./render";
import type { Audience, SummaryTarget } from "./snapshot";
import type { SummaryFact } from "./generate";

export const SUMMARY_ROLES = ["super_admin", "admin", "project_manager", "estimator", "staff", "designer", "superintendent"];
export const CLIENT_SEND_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export type Recipient = { id: string; name: string; email: string | null; onRecord?: boolean };

export async function loadRecipients(target: SummaryTarget, id: string): Promise<{ staff: Recipient[]; contacts: Recipient[] }> {
  const sb = getSupabaseAdmin();
  const people = await loadAssignableStaff();
  const onRecord = new Set<string>();
  const contacts: Recipient[] = [];
  const name = (c: { first_name?: string | null; last_name?: string | null; company?: string | null; email?: string | null }) =>
    `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || c.email || "Contact";

  if (target === "job") {
    const [{ data: users }, { data: jcs }] = await Promise.all([
      sb.from("job_internal_users").select("staff_user_id").eq("job_id", id),
      sb.from("job_contacts").select("role,contact:contacts(id,first_name,last_name,company,email)").eq("job_id", id),
    ]);
    for (const u of users ?? []) if (u.staff_user_id) onRecord.add(u.staff_user_id as string);
    for (const row of (jcs ?? []) as unknown as { role: string; contact: { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null } | null }[]) {
      if (row.contact && row.role === "client") contacts.push({ id: row.contact.id, name: name(row.contact), email: row.contact.email });
    }
  } else {
    const { data: o } = await sb.from("pipeline_opportunities").select("contact_id,assigned_owner_id").eq("id", id).maybeSingle();
    if (o?.assigned_owner_id) onRecord.add(o.assigned_owner_id as string);
    if (o?.contact_id) {
      const { data: c } = await sb.from("contacts").select("id,first_name,last_name,company,email").eq("id", o.contact_id).maybeSingle();
      if (c) contacts.push({ id: c.id as string, name: name(c), email: (c.email as string) ?? null });
    }
  }
  const staff = people.map((p) => ({ id: p.id, name: p.name, email: p.email, onRecord: onRecord.has(p.id) }))
    .sort((a, b) => Number(b.onRecord) - Number(a.onRecord) || a.name.localeCompare(b.name));
  return { staff, contacts };
}

export type SendInput = {
  target: SummaryTarget;
  id: string;
  audience: Audience;
  headline: string;
  facts: SummaryFact[];
  body_html: string;
  note?: string | null;
  staff_ids?: string[];
  contact_ids?: string[];
  extra_emails?: string[];
  post_to_portal?: boolean;
};

async function projectInfo(target: SummaryTarget, id: string): Promise<{ name: string; number: string | null; kind: "Job" | "Pre-Con" } | null> {
  const sb = getSupabaseAdmin();
  if (target === "job") {
    const { data } = await sb.from("jobs").select("job_name,job_number").eq("id", id).maybeSingle();
    return data ? { name: data.job_name as string, number: (data.job_number as string) ?? null, kind: "Job" } : null;
  }
  const { data } = await sb.from("pipeline_opportunities").select("opportunity_name,job_number").eq("id", id).maybeSingle();
  return data ? { name: data.opportunity_name as string, number: (data.job_number as string) ?? null, kind: "Pre-Con" } : null;
}

export async function sendSummary(input: SendInput, actor: { id: string; name: string; role: string }) {
  if (input.audience === "client" && !CLIENT_SEND_ROLES.includes(actor.role)) {
    throw Object.assign(new Error(`Your role (${actor.role}) can't send summaries to clients.`), { status: 403 });
  }
  const headline = input.headline?.trim().slice(0, 200);
  if (!headline) throw Object.assign(new Error("The summary needs a headline."), { status: 400 });
  const body = sanitizeHtmlServer(input.body_html);
  if (!htmlToText(body)) throw Object.assign(new Error("The summary is empty."), { status: 400 });
  const project = await projectInfo(input.target, input.id);
  if (!project) throw Object.assign(new Error("That record wasn't found."), { status: 404 });
  const facts = (input.facts ?? []).slice(0, 6).map((f) => ({ label: String(f.label).slice(0, 40), value: String(f.value).slice(0, 80) }));

  const { staff, contacts } = await loadRecipients(input.target, input.id);
  const to: { name: string; email: string; kind: "staff" | "client" | "other" }[] = [];
  for (const sid of input.staff_ids ?? []) {
    const s = staff.find((x) => x.id === sid);
    if (s?.email) to.push({ name: s.name, email: s.email, kind: "staff" });
  }
  if (input.audience === "client") {
    for (const cid of input.contact_ids ?? []) {
      const c = contacts.find((x) => x.id === cid);
      if (c?.email) to.push({ name: c.name, email: c.email, kind: "client" });
    }
    for (const raw of input.extra_emails ?? []) {
      const e = raw.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) to.push({ name: e, email: e, kind: "other" });
    }
  }
  const unique = [...new Map(to.map((t) => [t.email.toLowerCase(), t])).values()];
  if (!unique.length && !input.post_to_portal) throw Object.assign(new Error("Choose at least one recipient."), { status: 400 });

  const app = publicAppUrl();
  const href = input.target === "job" ? `/dashboard/jobs/${input.id}/summary` : `/dashboard/sales/${input.id}`;
  const html = summaryDocumentHtml({
    audience: input.audience, kind: project.kind,
    projectName: project.name, projectNumber: project.number,
    headline, facts, bodyHtml: body, preparedBy: actor.name,
    dateLabel: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Phoenix" }).format(new Date()),
    appUrl: app, note: input.note ?? null,
    cta: input.audience === "team"
      ? { label: `Open in the CMI Dashboard`, url: `${app}${href}` }
      : input.target === "job" ? { label: "View your project portal", url: `${app}/client/jobs/${input.id}/overview` } : null,
  });
  const subject = `${input.audience === "team" ? "[Internal] " : ""}${project.name} — Executive Summary`;

  const sent: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const r of unique) {
    if (r.kind !== "staff" && (await isSuppressed("email", r.email).catch(() => false))) { skipped.push({ name: r.name, reason: "unsubscribed from email" }); continue; }
    const ok = await sendEmail(r.email, subject, html).catch(() => false);
    if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "email failed" });
  }

  let posted = false;
  if (input.post_to_portal && input.audience === "client" && input.target === "job") {
    await createJobUpdate(input.id, {
      title: headline,
      body: [htmlToText(body)].join("\n\n"),
      update_type: "general",
      visibility: "client_visible",
    }, actor.name);
    posted = true;
  }

  await getSupabaseAdmin().from("executive_summaries").insert({
    job_id: input.target === "job" ? input.id : null,
    opportunity_id: input.target === "precon" ? input.id : null,
    audience: input.audience, headline, body_html: body, facts,
    status: "sent", sent_to: unique.filter((u) => sent.includes(u.name)), posted_to_portal: posted,
    created_by: actor.id, created_by_name: actor.name, sent_at: new Date().toISOString(),
  });

  return { sent, skipped, posted };
}

export async function loadHistory(target: SummaryTarget, id: string) {
  const { data } = await getSupabaseAdmin().from("executive_summaries")
    .select("id,audience,headline,body_html,facts,sent_to,posted_to_portal,created_by_name,sent_at,created_at")
    .eq(target === "job" ? "job_id" : "opportunity_id", id)
    .order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}
