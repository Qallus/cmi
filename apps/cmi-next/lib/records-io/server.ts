// Server-side import for Pre-Con and Jobs. Each row goes through the same
// create path as the dashboard forms (createOpportunity / createJob), so
// numbering triggers, stage history, job settings and activity logs all apply.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createOpportunity } from "@/lib/pipeline/data";
import { createJob } from "@/lib/jobs/data";
import type { OpportunityDraft } from "@/lib/pipeline/types";
import type { JobDraft } from "@/lib/jobs/types";
import { coerceRecord, CMI_NUMBER, NAME_KEY, type RecordTarget } from "./fields";

export type DuplicateAction = "skip" | "create";
export type RowResult = { name: string; status: "imported" | "skipped" | "error"; message?: string; id?: string };
type Actor = { name?: string | null; id?: string | null };

const PRECON_NUMBER = /^(\d{2}_\d{3}|CM-\d{4}-\d{4})$/;

// Find a contact by email (or exact name when there's no email); create one if missing.
async function findOrCreateClient(f: Record<string, unknown>): Promise<string | null> {
  const name = typeof f.client_name === "string" ? f.client_name.trim() : "";
  const email = typeof f.client_email === "string" ? f.client_email.trim().toLowerCase() : "";
  const phone = typeof f.client_phone === "string" ? f.client_phone.trim() : "";
  if (!name && !email) return null;
  const sb = getSupabaseAdmin();
  const [first, ...rest] = name.split(/\s+/);
  const last = rest.join(" ");

  if (email) {
    const { data } = await sb.from("contacts").select("id").ilike("email", email).limit(1).maybeSingle();
    if (data) return data.id as string;
  } else if (first && last) {
    const { data } = await sb.from("contacts").select("id").ilike("first_name", first).ilike("last_name", last).limit(1).maybeSingle();
    if (data) return data.id as string;
  }
  const { data, error } = await sb.from("contacts").insert({
    first_name: first || email, last_name: last, email: email || null, phone: phone || null,
    type: "Client", status: "active", updated_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw new Error(`Client contact: ${error.message}`);
  return data.id as string;
}

async function existingNames(target: RecordTarget): Promise<Set<string>> {
  const sb = getSupabaseAdmin();
  const { data } = target === "precon"
    ? await sb.from("pipeline_opportunities").select("opportunity_name")
    : await sb.from("jobs").select("job_name").is("archived_at", null).eq("is_template", false);
  const key = NAME_KEY[target];
  return new Set((data ?? []).map((r) => String((r as Record<string, unknown>)[key] ?? "").trim().toLowerCase()));
}

function stripClient(f: Record<string, unknown>) {
  const { client_name: _n, client_email: _e, client_phone: _p, job_number: _j, job_type: _t, ...rest } = f;
  return rest;
}

export async function importRecords(
  target: RecordTarget,
  rows: Record<string, unknown>[],
  duplicateAction: DuplicateAction,
  actor: Actor,
): Promise<RowResult[]> {
  const sb = getSupabaseAdmin();
  const seen = await existingNames(target);
  const jobTypes = target === "jobs"
    ? new Map(((await sb.from("job_types").select("id,name")).data ?? []).map((t) => [String(t.name).toLowerCase(), t.id as string]))
    : new Map<string, string>();

  const results: RowResult[] = [];
  for (const raw of rows) {
    const { fields } = coerceRecord(raw, target);
    let name = String(fields[NAME_KEY[target]] ?? "").trim();
    if (!name) { results.push({ name: "(no name)", status: "error", message: "Name is required" }); continue; }

    try {
      if (target === "precon") {
        if (seen.has(name.toLowerCase()) && duplicateAction === "skip") { results.push({ name, status: "skipped", message: "Already in Pre-Con" }); continue; }
        const contactId = await findOrCreateClient(fields);
        const number = typeof fields.job_number === "string" && PRECON_NUMBER.test(fields.job_number) ? fields.job_number : null;
        const draft = { ...stripClient(fields), opportunity_name: name, ...(contactId ? { contact_id: contactId } : {}) } as OpportunityDraft;
        const created = await createOpportunity(draft, actor, number);
        seen.add(name.toLowerCase());
        results.push({ name, status: "imported", id: created.id });
      } else {
        // "26_030_Lillie Residence" → number 26_030, name "Lillie Residence".
        let prefix = typeof fields.job_number === "string" ? fields.job_number.match(CMI_NUMBER)?.[1] ?? null : null;
        const lead = name.match(CMI_NUMBER);
        if (lead) { prefix = prefix ?? lead[1]; name = name.slice(lead[0].length).trim() || name; }
        if (seen.has(name.toLowerCase()) && duplicateAction === "skip") { results.push({ name, status: "skipped", message: "Already in Jobs" }); continue; }

        const typeName = typeof fields.job_type === "string" ? fields.job_type.toLowerCase() : "";
        const draft = { ...stripClient(fields), job_name: name, job_type_id: jobTypes.get(typeName) ?? null } as JobDraft;
        const job = await createJob(draft, actor, { numberPrefix: prefix });
        const contactId = await findOrCreateClient(fields);
        if (contactId) {
          await sb.from("job_contacts").insert({ job_id: job.id, contact_id: contactId, role: "client", is_primary: true });
        }
        seen.add(name.toLowerCase());
        const note = typeName && !jobTypes.has(typeName) ? `Job type "${fields.job_type}" not found — left blank` : undefined;
        results.push({ name, status: "imported", id: job.id, message: note });
      }
    } catch (err) {
      results.push({ name, status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
