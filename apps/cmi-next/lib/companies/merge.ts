// Merge a duplicate company into the one being kept. Server-only.
//
// Everything that points at the duplicate is moved to the survivor (contacts,
// deals, documents, applications, interviews, MSA signatures), the survivor's
// empty fields are filled from the duplicate, and the duplicate is archived —
// never deleted — with the merge written to record_changes.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { findDuplicatePairs, mergePatch, type DuplicatePair } from "./dedupe";

// Every table with a company_id foreign key (checked against the live schema
// 2026-10-28) plus msa_signatures from the Phase 1 migration.
const REFERENCING = ["contacts", "deals", "company_documents", "prequal_applications", "interviews", "msa_signatures"] as const;

export async function loadDuplicatePairs(): Promise<DuplicatePair[]> {
  const { data, error } = await getSupabaseAdmin().from("companies").select("id, name, created_at").is("archived_at", null).limit(5000);
  if (error) throw new Error(error.message);
  return findDuplicatePairs((data ?? []) as { id: string; name: string; created_at: string }[]);
}

export async function mergeCompanies(survivorId: string, duplicateId: string, actorId: string): Promise<{ moved: Record<string, number> }> {
  if (survivorId === duplicateId) throw new Error("Pick two different companies.");
  const supabase = getSupabaseAdmin();
  const [{ data: survivor }, { data: duplicate }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", survivorId).maybeSingle(),
    supabase.from("companies").select("*").eq("id", duplicateId).maybeSingle(),
  ]);
  if (!survivor || !duplicate) throw new Error("One of those companies no longer exists.");
  if (duplicate.archived_at) throw new Error(`${duplicate.name} is already archived.`);

  const moved: Record<string, number> = {};
  for (const table of REFERENCING) {
    const { data, error } = await supabase.from(table).update({ company_id: survivorId }).eq("company_id", duplicateId).select("id");
    // A table that doesn't exist yet (pre-migration) shouldn't block the merge.
    if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(`${table}: ${error.message}`);
    moved[table] = data?.length ?? 0;
  }

  const patch = mergePatch(survivor, duplicate);
  const now = new Date().toISOString();
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("companies").update({ ...patch, updated_at: now, updated_by: actorId }).eq("id", survivorId);
    if (error) throw new Error(error.message);
  }
  const { error: archErr } = await supabase.from("companies").update({
    archived_at: now, updated_at: now, updated_by: actorId,
    internal_notes: [duplicate.internal_notes, `Merged into ${survivor.name} on ${now.slice(0, 10)}.`].filter(Boolean).join("\n\n"),
  }).eq("id", duplicateId);
  if (archErr) throw new Error(archErr.message);

  await supabase.from("record_changes").insert([
    { table_name: "companies", record_id: survivorId, record_label: survivor.name, op: "merge", field: "merged_from", old_value: null, new_value: `${duplicate.name} (${duplicateId})`, changed_by: actorId },
    { table_name: "companies", record_id: duplicateId, record_label: duplicate.name, op: "merge", field: "merged_into", old_value: null, new_value: `${survivor.name} (${survivorId})`, changed_by: actorId },
  ]);
  return { moved };
}
