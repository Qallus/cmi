// Executors behind Bolt's generic CRUD tools. All access goes through the
// service-role client; role gating is enforced here per entity.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logMessage } from "@/lib/communications/data";
import { getEntity } from "./entities";
import type { AgentEntity, StaffContext, ToolResult } from "./types";

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

const selectColumns = (entity: AgentEntity) =>
  [entity.idColumn, ...entity.fields.map((f) => f.name)].filter((v, i, a) => a.indexOf(v) === i).join(", ");

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

export async function listRecords(entityKey: string, opts: { search?: string; filters?: Record<string, unknown>; limit?: number }): Promise<ToolResult> {
  const entity = getEntity(entityKey);
  if (!entity) return { error: `Unknown entity "${entityKey}".` };
  const sb = getSupabaseAdmin();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

  let q = sb.from(entity.table).select(selectColumns(entity)).limit(limit);
  if (entity.orderBy) q = q.order(entity.orderBy.column, { ascending: entity.orderBy.ascending });

  if (opts.filters) {
    for (const [k, v] of Object.entries(opts.filters)) {
      if (entity.fields.some((f) => f.name === k) || k === entity.idColumn) q = q.eq(k, v as never);
    }
  }
  if (opts.search && entity.searchColumns?.length) {
    const clean = opts.search.replace(/[,%()]/g, " ").trim();
    q = q.or(entity.searchColumns.map((c) => `${c}.ilike.%${clean}%`).join(","));
  }

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, records: data ?? [] };
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
  const { error } = await getSupabaseAdmin().from(entity.table).delete().eq(entity.idColumn, id);
  if (error) return { error: error.message };
  return { message: `Deleted ${entity.label} ${id}.` };
}

// Outbound messaging (email via Resend, SMS via Twilio) + logging.
export async function sendMessage(input: {
  channel: "email" | "sms"; to: string; subject?: string; body: string; contactId?: string | null;
}, ctx: StaffContext): Promise<ToolResult> {
  const commsRoles = ["super_admin", "admin", "project_manager", "estimator"];
  if (!commsRoles.includes(ctx.role)) return { error: `Your role (${ctx.role}) can't send messages.` };

  if (input.channel === "email") {
    const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
    const from = process.env.RESEND_FROM_EMAIL || "noreply@constructedmatter.com";
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
