// Executors behind Bolt's generic CRUD tools. All access goes through the
// service-role client; role gating is enforced here per entity.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logMessage } from "@/lib/communications/data";
import { isSuppressed } from "@/lib/messaging/consent";
import { getEntity } from "./entities";
import type { AgentEntity, StaffContext, ToolResult } from "./types";
import { fromAddress } from "@/lib/email/from";
import { trashRecord, TrashError } from "@/lib/mcp/trash";

export function canWrite(entity: AgentEntity, ctx: StaffContext): boolean {
  return entity.writeRoles.includes(ctx.role);
}
export function canDelete(entity: AgentEntity, ctx: StaffContext): boolean {
  return (entity.deleteRoles ?? entity.writeRoles).includes(ctx.role);
}

function slugify(input: string): string {
  return String(input || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
}

function coerce(type: string, v: unknown): unknown {
  if (v === null || v === undefined || v === "") return type === "string[]" ? [] : null;
  switch (type) {
    case "number": return Number(v);
    case "boolean": return v === true || v === "true" || v === 1 || v === "1";
    case "string[]": return Array.isArray(v) ? v : String(v).split(",").map((s) => s.trim()).filter(Boolean);
    default: return v;
  }
}

function pickAllowed(entity: AgentEntity, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of entity.fields) {
    if (f.readonly) continue;
    if (f.name in data) out[f.name] = coerce(f.type, data[f.name]);
  }
  return out;
}

// Select all columns — resilient to any drift between the registry field list
// and the actual table columns (reads never fail on a missing column).
const selectColumns = (_entity: AgentEntity) => "*";

async function ensureUniqueSlug(table: string, base: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const root = slugify(base);
  let candidate = root;
  for (let i = 0; i < 25; i++) {
    const { data } = await sb.from(table).select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${root}-${i + 2}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// Models pick the wrong field ("status": "Prospect" when Prospect is a contact
// type) or filter on the record type itself ("status": "Contact"), and a
// silent 0 gets reported as fact. Before querying, a value that belongs to a
// different enum field moves there, a filter naming the entity is dropped,
// and every change is reported back so Bolt can say what it searched.
function normalizeFilters(entity: AgentEntity, filters?: Record<string, unknown>): { filters: Record<string, unknown>; notes: string[] } {
  const out: Record<string, unknown> = {};
  const notes: string[] = [];
  if (!filters) return { filters: out, notes };
  const enumFields = entity.fields.filter((f) => f.type === "enum" && f.enumValues?.length);
  const owner = (v: string) => enumFields.find((f) => f.enumValues!.some((e) => e.toLowerCase() === v.toLowerCase()));
  const selfNames = [entity.key, entity.label, entity.plural].map((n) => n.toLowerCase());

  for (const [k, v] of Object.entries(filters)) {
    const field = entity.fields.find((f) => f.name === k);
    if (typeof v !== "string") { if (field || k === entity.idColumn) out[k] = v; continue; }
    if (selfNames.includes(v.toLowerCase()) || selfNames.includes(`${v.toLowerCase()}s`)) {
      notes.push(`Ignored ${k}="${v}": that's the record type itself, not a value.`);
      continue;
    }
    const fits = field?.type === "enum" ? field.enumValues?.some((e) => e.toLowerCase() === v.toLowerCase()) : !!field;
    if (fits || k === entity.idColumn) { out[k] = v; continue; }
    const right = owner(v);
    if (right && !(right.name in out)) {
      notes.push(`"${v}" is a ${right.name}, not a ${k}; searched ${right.name}="${v}".`);
      out[right.name] = v;
    } else if (field) {
      out[k] = v;
      if (field.enumValues) notes.push(`"${v}" isn't a known ${k}. Valid ${k} values: ${field.enumValues.join(", ")}.`);
    } else {
      notes.push(`Ignored unknown field "${k}".`);
    }
  }
  return { filters: out, notes };
}

/** When a filtered search finds nothing, the valid values for those fields. */
function zeroHint(entity: AgentEntity, filters: Record<string, unknown>): string | undefined {
  const parts = Object.keys(filters)
    .map((k) => entity.fields.find((f) => f.name === k))
    .filter((f): f is NonNullable<typeof f> => !!f?.enumValues?.length)
    .map((f) => `${f.name}: ${f.enumValues!.join(", ")}`);
  return parts.length ? `No matches. Check the filter values against: ${parts.join("; ")}. Try again with a corrected filter, or count with no filter.` : undefined;
}

// Filters and search shared by list and count, so a count always matches the
// list it summarises. Text and enum values match case-insensitively ("lead"
// finds "Lead"); a null value matches empty fields.
function applyFilters<Q extends { eq: any; ilike: any; is: any; or: any }>(q: Q, entity: AgentEntity, filters?: Record<string, unknown>, search?: string): Q {
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      const field = entity.fields.find((f) => f.name === k);
      if (!field && k !== entity.idColumn) continue;
      if (v === null) q = q.is(k, null);
      else if (field && (field.type === "string" || field.type === "enum" || field.type === "text") && typeof v === "string") {
        q = q.ilike(k, v.replace(/[\\%_]/g, (c) => `\\${c}`));
      } else q = q.eq(k, v as never);
    }
  }
  if (search && entity.searchColumns?.length) {
    // Tokenize: each word must match at least one search column (AND across
    // words, OR across columns) so "Jeremy Waters" matches first+last name.
    const tokens = search.replace(/[,%()]/g, " ").split(/\s+/).map((t) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      q = q.or(entity.searchColumns.map((c) => `${c}.ilike.%${token}%`).join(","));
    }
  }
  return q;
}

export async function listRecords(entityKey: string, opts: { search?: string; filters?: Record<string, unknown>; limit?: number }): Promise<ToolResult> {
  const entity = getEntity(entityKey);
  if (!entity) return { error: `Unknown entity "${entityKey}".` };
  const sb = getSupabaseAdmin();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

  const { filters, notes } = normalizeFilters(entity, opts.filters);
  let q = sb.from(entity.table).select(selectColumns(entity), { count: "exact" }).limit(limit);
  if (entity.orderBy) q = q.order(entity.orderBy.column, { ascending: entity.orderBy.ascending });
  q = applyFilters(q, entity, filters, opts.search);

  const { data, error, count } = await q;
  if (error) return { error: error.message };
  // `returned` is this page; `total` is every match. Totals must come from
  // `total` (or count_records), never from how many rows came back.
  const total = count ?? data?.length ?? 0;
  return {
    returned: data?.length ?? 0, total, records: data ?? [],
    ...(notes.length ? { adjusted: notes } : {}),
    ...(total === 0 && Object.keys(filters).length ? { hint: zeroHint(entity, filters) } : {}),
  };
}

/**
 * Exact number of matching records, optionally broken down by one field
 * (e.g. contacts by type). Counting is done by the database, not by reading a
 * page of rows, so "how many contacts" gets 987, not the 20 that fit a list.
 */
export async function countRecords(entityKey: string, opts: { search?: string; filters?: Record<string, unknown>; group_by?: string }): Promise<ToolResult> {
  const entity = getEntity(entityKey);
  if (!entity) return { error: `Unknown entity "${entityKey}".` };
  const sb = getSupabaseAdmin();

  const { filters, notes } = normalizeFilters(entity, opts.filters);
  const extra = (total: number) => ({
    ...(notes.length ? { adjusted: notes } : {}),
    ...(total === 0 && Object.keys(filters).length ? { hint: zeroHint(entity, filters) } : {}),
  });
  const head = applyFilters(sb.from(entity.table).select("*", { count: "exact", head: true }), entity, filters, opts.search);
  const { count, error } = await head;
  if (error) return { error: error.message };
  const total = count ?? 0;

  if (!opts.group_by) return { entity: entity.plural, total, ...extra(total) };
  if (!entity.fields.some((f) => f.name === opts.group_by)) return { error: `"${opts.group_by}" isn't a field of ${entity.plural}. Call describe_entity to see fields.` };

  const groups: Record<string, number> = {};
  const PAGE = 1000;
  for (let from = 0; from < Math.min(total, 20000); from += PAGE) {
    const field = opts.group_by;
    const res: { data: unknown[] | null; error: { message: string } | null } =
      await applyFilters(sb.from(entity.table).select(field).range(from, from + PAGE - 1), entity, filters, opts.search);
    if (res.error) return { error: res.error.message };
    for (const row of (res.data ?? []) as Record<string, unknown>[]) {
      const key = row[opts.group_by] == null || row[opts.group_by] === "" ? "(none)" : String(row[opts.group_by]);
      groups[key] = (groups[key] ?? 0) + 1;
    }
  }
  return { entity: entity.plural, total, by: opts.group_by, groups, ...extra(total) };
}

export async function getRecord(entityKey: string, id: string): Promise<ToolResult> {
  const entity = getEntity(entityKey);
  if (!entity) return { error: `Unknown entity "${entityKey}".` };
  const { data, error } = await getSupabaseAdmin().from(entity.table).select(selectColumns(entity)).eq(entity.idColumn, id).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Record not found." };
  return { record: data };
}

export async function createRecord(entityKey: string, data: Record<string, unknown>, ctx: StaffContext): Promise<ToolResult> {
  const entity = getEntity(entityKey);
  if (!entity) return { error: `Unknown entity "${entityKey}".` };
  if (!canWrite(entity, ctx)) return { error: `Your role (${ctx.role}) can't create ${entity.plural}.` };

  const row = pickAllowed(entity, data);
  for (const f of entity.fields) {
    if (f.required && (row[f.name] === undefined || row[f.name] === null || row[f.name] === "")) {
      return { error: `Missing required field "${f.name}" for ${entity.label}.` };
    }
  }
  if (entity.customIdPrefix) row[entity.idColumn] = `${entity.customIdPrefix}${Date.now()}`;
  if (entity.slugFrom && !row.slug && row[entity.slugFrom]) {
    row.slug = await ensureUniqueSlug(entity.table, String(row[entity.slugFrom]));
  }
  const now = new Date().toISOString();
  if (entity.hasUpdatedAt) row.updated_at = now;

  const { data: created, error } = await getSupabaseAdmin().from(entity.table).insert(row).select(selectColumns(entity)).single();
  if (error) return { error: error.message };
  return { created, message: `Created ${entity.label}.` };
}

export async function updateRecord(entityKey: string, id: string, data: Record<string, unknown>, ctx: StaffContext): Promise<ToolResult> {
  const entity = getEntity(entityKey);
  if (!entity) return { error: `Unknown entity "${entityKey}".` };
  if (!canWrite(entity, ctx)) return { error: `Your role (${ctx.role}) can't update ${entity.plural}.` };

  const row = pickAllowed(entity, data);
  if (Object.keys(row).length === 0) return { error: "No valid fields to update." };
  if (entity.hasUpdatedAt) row.updated_at = new Date().toISOString();

  const { data: updated, error } = await getSupabaseAdmin().from(entity.table).update(row).eq(entity.idColumn, id).select(selectColumns(entity)).single();
  if (error) return { error: error.message };
  return { updated, message: `Updated ${entity.label}.` };
}

export async function deleteRecord(entityKey: string, id: string, ctx: StaffContext): Promise<ToolResult> {
  const entity = getEntity(entityKey);
  if (!entity) return { error: `Unknown entity "${entityKey}".` };
  if (!canDelete(entity, ctx)) return { error: `Your role (${ctx.role}) can't delete ${entity.plural}.` };
  // AI never hard-deletes: the record goes to the trash (Settings → Claude →
  // Activity) and can be restored. Records others depend on are refused.
  try {
    const { label, trashId } = await trashRecord(entityKey, id, ctx, "bolt");
    return { message: `Moved ${entity.label} "${label}" to the trash. It can be restored from Settings → Claude → Activity.`, trash_id: trashId };
  } catch (err) {
    return { error: err instanceof TrashError ? err.message : `Couldn't delete: ${(err as Error).message}` };
  }
}

// Outbound messaging (email via Resend, SMS via Twilio) + logging.
export async function sendMessage(input: {
  channel: "email" | "sms"; to: string; subject?: string; body: string; contactId?: string | null;
}, ctx: StaffContext): Promise<ToolResult> {
  const commsRoles = ["super_admin", "admin", "project_manager", "estimator"];
  if (!commsRoles.includes(ctx.role)) return { error: `Your role (${ctx.role}) can't send messages.` };

  if (await isSuppressed(input.channel, input.to)) {
    return { error: `${input.to} has opted out of ${input.channel.toUpperCase()} and was not contacted.` };
  }

  if (input.channel === "email") {
    const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
    const from = fromAddress("noreply@constructedmatter.com");
    if (!key) return { error: "Email not configured (RESEND_API_KEY)." };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject || "(no subject)", html: input.body, text: input.body }),
    });
    if (!res.ok) return { error: `Email send failed: ${await res.text()}` };
    const json = await res.json().catch(() => ({})) as { id?: string };
    await logMessage({
      direction: "outbound", channel: "email", contact_id: input.contactId ?? null,
      to_address: input.to, from_address: from, subject: input.subject ?? null, body: input.body,
      status: "sent", project_id: null, quote_id: null, provider: "resend", provider_id: json.id ?? null,
      error_message: null, duration_seconds: null, recording_url: null, sent_at: new Date().toISOString(),
    }).catch(() => {});
    return { message: `Email sent to ${input.to}.`, id: json.id };
  }

  // SMS
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, fromNum = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !fromNum) return { error: "SMS not configured (Twilio)." };
  const creds = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: input.to, From: fromNum, Body: input.body }).toString(),
  });
  if (!res.ok) return { error: `SMS send failed: ${await res.text()}` };
  const json = await res.json().catch(() => ({})) as { sid?: string };
  await logMessage({
    direction: "outbound", channel: "sms", contact_id: input.contactId ?? null,
    to_address: input.to, from_address: fromNum, subject: null, body: input.body,
    status: "sent", project_id: null, quote_id: null, provider: "twilio", provider_id: json.sid ?? null,
    error_message: null, duration_seconds: null, recording_url: null, sent_at: new Date().toISOString(),
  }).catch(() => {});
  return { message: `SMS sent to ${input.to}.`, sid: json.sid };
}
