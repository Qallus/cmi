// AI "delete" = trash. Every record an AI client (Claude via MCP, or Bolt)
// removes lands in record_trash and can be restored from Settings → Claude →
// Activity. How each kind is trashed is TRASH_POLICY in ./safety. Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { recordLabel, trashRuleFor } from "./safety";

export class TrashError extends Error {}

export type TrashRow = {
  id: string; entity: string; record_id: string; label: string | null; method: string;
  deleted_by: string | null; deleted_via: string; deleted_at: string; restored_at: string | null;
};

/** Move one record to the trash. Returns the trash row id and what it was. */
export async function trashRecord(
  entity: string, recordId: string, actor: { id: string }, via: "mcp" | "bolt" | "dashboard",
): Promise<{ trashId: string; label: string; before: Record<string, unknown> }> {
  const rule = trashRuleFor(entity);
  if (!rule) throw new TrashError(`${entity.replace(/_/g, " ")} records can't be deleted through AI because other records depend on them. Delete it from the dashboard.`);
  const supabase = getSupabaseAdmin();
  const { data: row, error: readErr } = await supabase.from(rule.table).select("*").eq("id", recordId).maybeSingle();
  if (readErr) throw new TrashError(readErr.message);
  if (!row) throw new TrashError(`No ${entity.replace(/_/g, " ")} with id ${recordId}.`);
  const before = row as Record<string, unknown>;
  const label = recordLabel(before, `${entity} ${recordId}`);

  if (rule.method === "archive") {
    if (before[rule.column]) throw new TrashError(`${label} is already archived.`);
    const patch: Record<string, unknown> = { [rule.column]: new Date().toISOString() };
    if (rule.byColumn) patch[rule.byColumn] = actor.id;
    const { error } = await supabase.from(rule.table).update(patch).eq("id", recordId);
    if (error) throw new TrashError(error.message);
  } else if (rule.method === "status") {
    if (before[rule.column] === rule.value) throw new TrashError(`${label} is already archived.`);
    const { error } = await supabase.from(rule.table).update({ [rule.column]: rule.value }).eq("id", recordId);
    if (error) throw new TrashError(error.message);
  }

  // Record the trash entry before a snapshot delete, so a failed delete
  // leaves an extra trash row rather than a lost record.
  const { data: trash, error: trashErr } = await supabase.from("record_trash").insert({
    entity, record_id: recordId, label, method: rule.method, snapshot: before, deleted_by: actor.id, deleted_via: via,
  }).select("id").single();
  if (trashErr || !trash) throw new TrashError(trashErr?.message ?? "Couldn't record the trash entry.");

  if (rule.method === "snapshot") {
    const { error } = await supabase.from(rule.table).delete().eq("id", recordId);
    if (error) {
      await supabase.from("record_trash").delete().eq("id", trash.id);
      throw new TrashError(error.message);
    }
  }
  return { trashId: trash.id as string, label, before };
}

/** Put a trashed record back exactly as it was. */
export async function restoreRecord(trashId: string, actor: { id: string }): Promise<{ entity: string; recordId: string; label: string }> {
  const supabase = getSupabaseAdmin();
  const { data: t } = await supabase.from("record_trash").select("*").eq("id", trashId).maybeSingle();
  if (!t) throw new TrashError("That trash entry doesn't exist.");
  if (t.restored_at) throw new TrashError(`${t.label ?? "That record"} was already restored.`);
  const rule = trashRuleFor(t.entity as string);
  if (!rule) throw new TrashError(`Can't restore ${t.entity} records.`);
  const snapshot = (t.snapshot ?? {}) as Record<string, unknown>;

  if (rule.method === "archive") {
    const patch: Record<string, unknown> = { [rule.column]: null };
    if (rule.byColumn) patch[rule.byColumn] = null;
    const { error } = await supabase.from(rule.table).update(patch).eq("id", t.record_id);
    if (error) throw new TrashError(error.message);
  } else if (rule.method === "status") {
    const previous = (snapshot[rule.column] as string | null) ?? "active";
    const { error } = await supabase.from(rule.table).update({ [rule.column]: previous }).eq("id", t.record_id);
    if (error) throw new TrashError(error.message);
  } else {
    const { error } = await supabase.from(rule.table).upsert(snapshot, { onConflict: "id" });
    if (error) throw new TrashError(`Couldn't restore: ${error.message}`);
  }

  await supabase.from("record_trash").update({ restored_at: new Date().toISOString(), restored_by: actor.id }).eq("id", trashId);
  return { entity: t.entity as string, recordId: t.record_id as string, label: (t.label as string) ?? t.record_id };
}

export async function listTrash(opts: { limit?: number; includeRestored?: boolean } = {}): Promise<TrashRow[]> {
  let q = getSupabaseAdmin().from("record_trash")
    .select("id, entity, record_id, label, method, deleted_by, deleted_via, deleted_at, restored_at")
    .order("deleted_at", { ascending: false }).limit(Math.min(opts.limit ?? 50, 200));
  if (!opts.includeRestored) q = q.is("restored_at", null);
  const { data } = await q;
  return (data ?? []) as TrashRow[];
}
