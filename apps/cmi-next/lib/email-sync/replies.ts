// Email reply sync: copies replies from people we emailed from the dashboard
// into `messages` (direction "inbound"), so they appear in the conversation
// history (e.g. "Earlier with this person" on a contact form submission).
//
// Emails from the dashboard go out from info@ with reply-to set to the staff
// member who wrote them, so replies land in either that person's inbox or
// info@. This reads those mailboxes through the Google Workspace delegation
// (lib/google), read-only, and only looks for mail FROM addresses we have
// emailed. Nothing else in anyone's inbox is touched or stored.
//
// Runs on page load for one person (best-effort, short timeout) and on a
// schedule via /api/email-sync/run for everyone emailed recently.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fromAddress } from "@/lib/email/from";
import { googleConfigured } from "@/lib/google/client";
import { gmailMessage, gmailMessageIdsFrom } from "@/lib/google/workspace";

const SENDERS_PER_QUERY = 20;

export type ReplySyncResult = { skipped?: string; mailboxes: number; checked: number; added: number; errors: string[] };

function bareEmail(value: string): string {
  return (value.match(/<([^>]+)>/)?.[1] ?? value).trim().toLowerCase();
}

/** Every Workspace mailbox a reply could land in: staff on the domain + the From address. */
async function mailboxes(): Promise<string[]> {
  const domain = (process.env.GOOGLE_WORKSPACE_DOMAIN || "").toLowerCase();
  const { data } = await getSupabaseAdmin().from("staff_users").select("email, role_slug")
    .in("status", ["active", "invited"]).not("role_slug", "in", "(client,vendor,subcontractor,viewer)");
  const set = new Set((data ?? []).map((r) => String(r.email).toLowerCase()).filter((e) => e.endsWith(`@${domain}`)));
  const shared = bareEmail(fromAddress());
  if (shared.endsWith(`@${domain}`)) set.add(shared);
  return [...set];
}

/** Addresses we emailed (outbound, email channel) since `since`, with their contact. */
async function recipients(since: Date, only?: string[]): Promise<Map<string, string | null>> {
  let q = getSupabaseAdmin().from("messages").select("to_address, contact_id, created_at")
    .eq("channel", "email").eq("direction", "outbound").gte("created_at", since.toISOString())
    .order("created_at", { ascending: false }).limit(1000);
  if (only?.length) q = q.in("to_address", only);
  const { data } = await q;
  const map = new Map<string, string | null>();
  for (const r of data ?? []) {
    const addr = bareEmail(String(r.to_address ?? ""));
    if (addr && !map.has(addr)) map.set(addr, (r.contact_id as string | null) ?? null);
  }
  return map;
}

export async function syncEmailReplies(opts: { contactEmails?: string[]; sinceDays?: number } = {}): Promise<ReplySyncResult> {
  const result: ReplySyncResult = { mailboxes: 0, checked: 0, added: 0, errors: [] };
  if (!googleConfigured()) return { ...result, skipped: "Google Workspace isn't connected." };

  const since = new Date(Date.now() - (opts.sinceDays ?? 30) * 86_400_000);
  const only = opts.contactEmails?.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const people = await recipients(since, only);
  if (!people.size) return result;

  const boxes = await mailboxes();
  result.mailboxes = boxes.length;
  const senders = [...people.keys()];
  const chunks: string[][] = [];
  for (let i = 0; i < senders.length; i += SENDERS_PER_QUERY) chunks.push(senders.slice(i, i + SENDERS_PER_QUERY));

  // Find candidate messages in every mailbox.
  const found: { box: string; id: string }[] = [];
  await Promise.all(boxes.map(async (box) => {
    for (const chunk of chunks) {
      try {
        for (const id of await gmailMessageIdsFrom(box, chunk, since)) found.push({ box, id });
      } catch (err) {
        result.errors.push(`${box}: ${err instanceof Error ? err.message : String(err)}`);
        return; // mailbox unreachable (e.g. an alias, not a user) — skip it
      }
    }
  }));
  result.checked = found.length;
  if (!found.length) return result;

  // Skip messages already logged (same Gmail message id).
  const supabase = getSupabaseAdmin();
  const ids = [...new Set(found.map((f) => f.id))];
  const { data: existing } = await supabase.from("messages").select("provider_id").eq("provider", "gmail").in("provider_id", ids);
  const seen = new Set((existing ?? []).map((r) => r.provider_id as string));

  for (const { box, id } of found) {
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      const m = await gmailMessage(box, id);
      if (!people.has(m.fromAddress)) continue;
      const { error } = await supabase.from("messages").insert({
        direction: "inbound",
        channel: "email",
        contact_id: people.get(m.fromAddress) ?? null,
        to_address: box,
        from_address: m.fromAddress,
        subject: m.subject,
        body: m.text,
        status: "received",
        provider: "gmail",
        provider_id: m.id,
        sent_at: m.date.toISOString(),
      });
      if (error) throw new Error(error.message);
      result.added += 1;
    } catch (err) {
      result.errors.push(`${box}/${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}
