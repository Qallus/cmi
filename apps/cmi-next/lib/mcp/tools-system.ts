// System tools: who am I, find a tool, confirm/cancel a previewed action,
// trash and restore, and my recent activity. cmi_confirm is the only way a
// high-risk action runs, and it runs the arguments stored at preview time.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { cancelPending, claimPending, finishPending, listPending } from "./actions";
import type { McpCaller } from "./auth";
import { checkCap, loadCaps, usedToday } from "./caps";
import { entityAllowed } from "./policy";
import { canTrash, recordLabel, tierAllowed, trashRuleFor, type CapGroup } from "./safety";
import { listTrash, restoreRecord, trashRecord } from "./trash";
import type { McpTool, ToolOutput } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const isAdmin = (c: McpCaller) => canTrash(c.ctx.role);

export function systemTools(all: () => McpTool[]): McpTool[] {
  return [
    {
      name: "cmi_whoami",
      title: "Who am I in CMI",
      description: "Your CMI identity for this connection: name, role, whether you have company-wide access, which app you're connected from, which risk tiers it may use, and today's usage against the daily caps.",
      risk: "read",
      inputSchema: () => obj(),
      run: async (_a, c) => {
        const caps = await loadCaps();
        const used = Object.fromEntries(await Promise.all((Object.keys(caps) as CapGroup[]).map(async (g) => [g, await usedToday(c.ctx.id, g)])));
        return { result: {
          name: c.ctx.displayName, email: c.ctx.email, role: c.ctx.role, can_read_financials: c.ctx.isAdmin,
          company_wide: c.companyWide, client: c.clientKind, allowed_tiers: c.allowedTiers,
          can_trash: isAdmin(c), daily_caps: caps, used_today: used,
        } };
      },
    },
    {
      name: "cmi_search_tools",
      title: "Find a CMI tool",
      description: "Search the CMI tools available to you by keyword (e.g. 'contact', 'deal', 'trash', 'daily log'). Returns name, risk tier and description.",
      risk: "read",
      inputSchema: () => obj({ keyword: str("Word to look for") }, ["keyword"]),
      run: async (a, c) => {
        const words = String(a.keyword ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const list = [];
        for (const t of all()) {
          if (!tierAllowed(t.risk, c.allowedTiers) || (t.available && !(await t.available(c)))) continue;
          const hay = `${t.name} ${t.title} ${t.description}`.toLowerCase();
          if (words.every((w) => hay.includes(w))) list.push({ name: t.name, risk: t.risk, description: t.description });
        }
        return { result: { tools: list } };
      },
    },
    {
      name: "cmi_confirm",
      title: "Confirm a previewed action",
      description: "Run a high-risk action you previewed earlier (send, delete, publish…). Call this ONLY after you showed the person the preview and they clearly said yes. Takes the confirmation_id from the preview; the stored action runs exactly once, within 15 minutes.",
      risk: "write",
      inputSchema: () => obj({ confirmation_id: str("The confirmation_id from the preview") }, ["confirmation_id"]),
      run: async (a, c) => {
        const id = String(a.confirmation_id ?? "");
        const pending = await claimPending(id, c);
        try {
          const tool = all().find((t) => t.name === pending.tool);
          if (!tool?.execute) throw new Error(`"${pending.tool}" can't be confirmed.`);
          // Permissions are checked again now, not just at preview time.
          if (!tierAllowed(tool.risk, c.allowedTiers) || (tool.available && !(await tool.available(c)))) {
            throw new Error(`You no longer have access to ${pending.tool}.`);
          }
          if (tool.capGroup) await checkCap(c.ctx.id, tool.capGroup);
          const out = await tool.execute(pending.args, c);
          await finishPending(id, { result: out.result });
          return { ...out, confirmationId: id, capGroup: tool.capGroup ?? null, executedTool: tool.name } as ToolOutput;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Action failed.";
          await finishPending(id, { error: message });
          throw err;
        }
      },
    },
    {
      name: "cmi_cancel",
      title: "Cancel a previewed action",
      description: "Cancel a high-risk action that's waiting for confirmation (when the person says no or changes their mind).",
      risk: "read",
      inputSchema: () => obj({ confirmation_id: str("The confirmation_id from the preview") }, ["confirmation_id"]),
      run: async (a, c) => ({ result: (await cancelPending(String(a.confirmation_id ?? ""), c))
        ? { cancelled: true } : { error: "Nothing pending with that id." } }),
    },
    {
      name: "cmi_pending_actions_list",
      title: "My actions waiting for confirmation",
      description: "High-risk actions you previewed in the last 15 minutes that haven't been confirmed or cancelled.",
      risk: "read",
      inputSchema: () => obj(),
      run: async (_a, c) => ({ result: { pending: (await listPending(c)).map((p) => ({
        confirmation_id: p.id, tool: p.tool, summary: p.preview?.summary, expires_at: p.expires_at,
      })) } }),
    },
    {
      name: "cmi_delete_record",
      title: "Move a record to the trash",
      description: "Move one CMI record to the trash (Super Admin / Admin only). Nothing is permanently deleted: it can be restored with cmi_restore or from Settings → Claude → Activity. Returns a preview first; run it with cmi_confirm after the person agrees. Records other records depend on (quotes, invoices, selections, schedule items) must be deleted in the dashboard.",
      risk: "high",
      capGroup: "trash",
      available: (c) => isAdmin(c),
      inputSchema: () => obj({ entity: str("Record type, e.g. job_note, daily_log, contact, job"), id: str("Record id") }, ["entity", "id"]),
      preview: async (a, c) => {
        const entity = String(a.entity ?? "");
        const id = String(a.id ?? "");
        if (!entityAllowed(entity, c.ctx)) throw new Error(`"${entity}" isn't available to you through Claude.`);
        const rule = trashRuleFor(entity);
        if (!rule) throw new Error(`${entity.replace(/_/g, " ")} records can't be deleted through AI because other records depend on them. Delete it from the dashboard.`);
        const { data: row } = await getSupabaseAdmin().from(rule.table).select("*").eq("id", id).maybeSingle();
        if (!row) throw new Error(`No ${entity.replace(/_/g, " ")} with id ${id}.`);
        const label = recordLabel(row as Record<string, unknown>, `${entity} ${id}`);
        return { summary: `Move ${entity.replace(/_/g, " ")} "${label}" to the trash. It can be restored afterwards.`, details: { entity, id, label }, entity, recordId: id };
      },
      execute: async (a, c) => {
        const entity = String(a.entity ?? "");
        const id = String(a.id ?? "");
        const { trashId, label, before } = await trashRecord(entity, id, c.ctx, "mcp");
        return { result: { trashed: true, label, trash_id: trashId, restore_with: "cmi_restore" }, entity, recordId: id, before, after: null };
      },
    },
    {
      name: "cmi_trash_list",
      title: "What's in the trash",
      description: "Records moved to the trash through AI (Super Admin / Admin), newest first, with the trash_id cmi_restore needs.",
      risk: "read",
      available: (c) => isAdmin(c),
      inputSchema: () => obj(),
      run: async () => ({ result: { trash: (await listTrash({ limit: 50 })).map((t) => ({
        trash_id: t.id, entity: t.entity, record_id: t.record_id, label: t.label, deleted_at: t.deleted_at, via: t.deleted_via,
      })) } }),
    },
    {
      name: "cmi_restore",
      title: "Restore from the trash",
      description: "Put a trashed record back exactly as it was (Super Admin / Admin). Takes the trash_id from cmi_trash_list or a delete result.",
      risk: "write",
      available: (c) => isAdmin(c),
      inputSchema: () => obj({ trash_id: str("trash_id") }, ["trash_id"]),
      run: async (a, c) => {
        const out = await restoreRecord(String(a.trash_id ?? ""), c.ctx);
        return { result: { restored: true, ...out }, entity: out.entity, recordId: out.recordId };
      },
    },
    {
      name: "cmi_audit_recent",
      title: "Recent AI activity",
      description: "Your most recent CMI tool calls from any AI app (what ran, when, whether it worked). Super Admin / Admin can pass everyone=true.",
      risk: "read",
      inputSchema: () => obj({ everyone: { type: "boolean", description: "Admins: include everyone" } }),
      run: async (a, c) => {
        let q = getSupabaseAdmin().from("mcp_audit_log")
          .select("created_at, tool, risk, client_kind, entity, record_id, success, error, staff_user_id")
          .order("created_at", { ascending: false }).limit(30);
        if (!(a.everyone === true && isAdmin(c))) q = q.eq("staff_user_id", c.ctx.id);
        const { data } = await q;
        return { result: { calls: data ?? [] } };
      },
    },
  ];
}
