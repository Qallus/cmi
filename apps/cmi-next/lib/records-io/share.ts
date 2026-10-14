// Share a Pre-Con opportunity or Job with other staff by Email, SMS or DM —
// the same flow as sharing a Pipeline deal (lib/deals/notify.ts), and the same
// recipient list, since these records carry the same client and budget detail.
// Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { publicAppUrl } from "@/lib/twilio";
import { isSuppressed } from "@/lib/messaging/consent";
import { findOrCreateConversation, sendMessage } from "@/lib/direct-messages/data";
import { sendEmail, sendSms, staffPhone, shareEmailHtml } from "@/lib/messaging/send";
import { listShareRecipients, DealShareError, type ShareChannel } from "@/lib/deals/notify";
import { STAGE_META } from "@/lib/pipeline/stages";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import type { RecordTarget } from "./fields";

type Actor = { id: string; name: string | null };

const usd = (v: number | null | undefined) =>
  v == null ? null : `$${Math.abs(Math.round(Number(v))).toLocaleString("en-US")}`;

async function summarize(target: RecordTarget, id: string): Promise<{ title: string; lines: string[]; url: string } | null> {
  const sb = getSupabaseAdmin();
  const base = publicAppUrl();
  if (target === "precon") {
    const { data: o } = await sb.from("pipeline_opportunities").select("*").eq("id", id).maybeSingle();
    if (!o) return null;
    const address = [o.project_address, o.city, o.state, o.zip_code].filter(Boolean).join(", ");
    return {
      title: o.opportunity_name,
      url: `${base}/dashboard/sales/${id}`,
      lines: [
        [o.job_number, o.opportunity_name].filter(Boolean).join(" · "),
        [STAGE_META[o.stage as keyof typeof STAGE_META]?.label ?? o.stage, usd(o.contract_value ?? o.estimated_project_value)].filter(Boolean).join(" · "),
        address || null,
        o.next_action ? `Next: ${o.next_action}${o.next_action_due ? ` (due ${o.next_action_due})` : ""}` : null,
      ].filter(Boolean) as string[],
    };
  }
  const { data: j } = await sb.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!j) return null;
  return {
    title: j.job_name,
    url: `${base}/dashboard/jobs/${id}/summary`,
    lines: [
      j.job_number || j.job_name,
      [JOB_STATUS_META[j.status as keyof typeof JOB_STATUS_META]?.label ?? j.status, usd(j.contract_price)].filter(Boolean).join(" · "),
      j.full_address || null,
      j.next_action ? `Next: ${j.next_action}${j.next_action_due ? ` (due ${j.next_action_due})` : ""}` : null,
    ].filter(Boolean) as string[],
  };
}

export async function shareRecord(
  target: RecordTarget,
  id: string,
  input: { channel: ShareChannel; recipient_ids: string[]; note?: string | null },
  actor: Actor,
) {
  if (!["email", "sms", "dm"].includes(input.channel)) throw new DealShareError("Choose Email, SMS or Message.");
  const ids = [...new Set(input.recipient_ids ?? [])].filter((r) => r !== actor.id || input.channel !== "dm");
  if (!ids.length) throw new DealShareError("Choose at least one recipient.");

  const allowed = new Map((await listShareRecipients()).map((r) => [r.id, r]));
  if (ids.some((r) => !allowed.has(r))) throw new DealShareError("This can only be shared with Pipeline staff.", 403);

  const rec = await summarize(target, id);
  if (!rec) throw new DealShareError(target === "precon" ? "Opportunity not found." : "Job not found.", 404);

  const kind = target === "precon" ? "Pre-Con" : "Job";
  const note = input.note?.trim().slice(0, 1000) || null;
  const from = actor.name ?? "A CMI teammate";
  const sent: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const rid of ids) {
    const r = allowed.get(rid)!;
    try {
      if (input.channel === "email") {
        if (!r.email) { skipped.push({ name: r.name, reason: "no email" }); continue; }
        const ok = await sendEmail(r.email, `${kind}: ${rec.title}`, shareEmailHtml({
          intro: `${from} shared a ${kind === "Job" ? "job" : "Pre-Con opportunity"} with you.`,
          lines: rec.lines, note, url: rec.url,
          cta: kind === "Job" ? "View job" : "View opportunity",
          footer: "Internal — client and budget details. Only CMI staff can open this link.",
        }));
        if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "email failed" });
      } else if (input.channel === "sms") {
        const phone = await staffPhone(rid);
        if (!phone) { skipped.push({ name: r.name, reason: "no phone" }); continue; }
        if (await isSuppressed("sms", phone)) { skipped.push({ name: r.name, reason: "opted out of SMS" }); continue; }
        const body = [`CMI ${kind} from ${from}:`, ...rec.lines, note ? `Note: ${note}` : null, rec.url].filter(Boolean).join("\n");
        const ok = await sendSms(phone, body);
        if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "SMS failed" });
      } else {
        const conversationId = await findOrCreateConversation({ id: actor.id, kind: "staff" }, { id: rid, kind: "staff" });
        await sendMessage(actor.id, conversationId, { body: [`${kind}: ${rec.lines.join("\n")}`, note, rec.url].filter(Boolean).join("\n\n") });
        sent.push(r.name);
      }
    } catch (e) {
      skipped.push({ name: r.name, reason: (e as Error).message || "failed" });
    }
  }
  return { sent, skipped };
}
