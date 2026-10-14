// Bolt ↔ punch lists. Bolt never saves punch items directly: it resolves the
// Job / Pre-Con / Pipeline record and stages the list for the staff member to
// confirm (PendingAction kind "punch_list"), then executePunchPending saves it.
// Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { addItems, createList, searchTargets } from "./data";
import {
  PARENT_COLUMN, PARENT_LABEL, PUNCH_PRIORITIES, canWritePunch,
  type PunchItemDraft, type PunchParent, type PunchParentType, type PunchPriority,
} from "./types";

export type PunchPending = {
  parent_type: PunchParentType;
  parent_id: string;
  parent_label: string;
  list_id: string | null;       // add to this existing list…
  list_title: string;           // …or create a new list with this title
  client_visible: boolean;
  items: PunchItemDraft[];
};

type Args = {
  target?: string;
  target_type?: string;
  list_title?: string;
  client_visible?: boolean;
  items?: { title?: string; location?: string; trade?: string; priority?: string; due_date?: string; assignee?: string; notes?: string }[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function stagePunchList(args: Args, role: string): Promise<
  { ok: true; pending: PunchPending; summary: string } | { ok: false; result: Record<string, unknown> }
> {
  if (!canWritePunch(role)) return { ok: false, result: { error: `Your role (${role}) can't add punch lists.` } };
  const target = (args.target ?? "").trim();
  if (!target) return { ok: false, result: { error: "Which Job, Pre-Con project or Pipeline deal should the punch list go on? Ask the user." } };

  const items = (args.items ?? [])
    .filter((i) => typeof i?.title === "string" && i.title.trim())
    .slice(0, 200);
  if (!items.length) return { ok: false, result: { error: "No punch items were given. Ask the user what to add." } };

  // Find the record. A UUID is used as-is; otherwise search by name/number.
  const type = (["job", "precon", "deal"] as const).includes(args.target_type as PunchParentType) ? (args.target_type as PunchParentType) : null;
  let matches: PunchParent[] = (await searchTargets(target)).filter((m) => !type || m.type === type);
  if (/^[0-9a-f-]{36}$/i.test(target)) matches = matches.filter((m) => m.id === target);
  const exact = matches.filter((m) => norm(m.label).includes(norm(target)) && norm(m.label).length - norm(target).length < 6);
  if (exact.length === 1) matches = exact;
  if (matches.length === 0) {
    return { ok: false, result: { error: `No ${type ? PARENT_LABEL[type] : "Job, Pre-Con or Pipeline"} record matches "${target}". Ask the user for the exact name.` } };
  }
  if (matches.length > 1) {
    return { ok: false, result: {
      status: "ambiguous",
      message: "More than one record matches. Ask the user which one they mean, then call propose_punch_list again with target set to the exact name and target_type.",
      candidates: matches.slice(0, 8).map((m) => ({ type: PARENT_LABEL[m.type], target_type: m.type, name: m.label })),
    } };
  }
  const parent = matches[0];

  // Add to an existing list with the same title on that record, if there is one.
  const listTitle = (args.list_title ?? "").trim() || "Punch List";
  const { data: existing } = await getSupabaseAdmin().from("punch_lists").select("id,title")
    .eq(PARENT_COLUMN[parent.type], parent.id).is("archived_at", null);
  const same = (existing ?? []).find((l) => norm(String(l.title)) === norm(listTitle));

  const staff = items.some((i) => i.assignee) ? await loadAssignableStaff() : [];
  const findStaff = (name?: string) => {
    if (!name?.trim()) return null;
    const n = norm(name);
    return staff.find((s) => norm(s.name) === n)?.id
      ?? staff.find((s) => norm(s.name).startsWith(n) || norm(s.name.split(" ")[0]) === n)?.id
      ?? null;
  };

  const drafts: PunchItemDraft[] = items.map((i) => ({
    title: i.title!.trim().slice(0, 300),
    location: i.location?.trim() || null,
    trade: i.trade?.trim() || null,
    priority: PUNCH_PRIORITIES.includes(i.priority as PunchPriority) ? (i.priority as PunchPriority) : "normal",
    due_date: i.due_date && /^\d{4}-\d{2}-\d{2}$/.test(i.due_date) ? i.due_date : null,
    assigned_to: findStaff(i.assignee),
    notes: i.notes?.trim() ? `<p>${i.notes.trim().replace(/[<>&]/g, "")}</p>` : null,
  }));

  const pending: PunchPending = {
    parent_type: parent.type,
    parent_id: parent.id,
    parent_label: parent.label,
    list_id: same ? String(same.id) : null,
    list_title: same ? String(same.title) : listTitle,
    client_visible: parent.type === "job" && !!args.client_visible,
    items: drafts,
  };
  const summary = same
    ? `Add ${drafts.length} item${drafts.length === 1 ? "" : "s"} to “${pending.list_title}” on ${PARENT_LABEL[parent.type]} ${parent.label}`
    : `Create punch list “${pending.list_title}” (${drafts.length} item${drafts.length === 1 ? "" : "s"}) on ${PARENT_LABEL[parent.type]} ${parent.label}`;
  return { ok: true, pending, summary };
}

export async function executePunchPending(p: PunchPending, ctx: { id: string; displayName: string; role: string }) {
  if (!canWritePunch(ctx.role)) return { error: `Your role (${ctx.role}) can't add punch lists.` };
  const actor = { id: ctx.id, name: ctx.displayName };
  if (p.list_id) {
    const added = await addItems(p.list_id, p.items, actor);
    return { ok: true, added: added.length, list_id: p.list_id };
  }
  const list = await createList({
    parent_type: p.parent_type, parent_id: p.parent_id, title: p.list_title,
    client_visible: p.client_visible, items: p.items,
  }, actor);
  return { ok: true, created: list.id, items: list.items.length };
}

export const PUNCH_TOOL_DEF = {
  type: "function",
  function: {
    name: "propose_punch_list",
    description:
      "Add punch list items to a Job, Pre-Con project or Pipeline deal (creates a new punch list, or adds to an existing list with the same title on that record). " +
      "Use when someone dictates or lists fixes/tasks for a walkthrough, e.g. 'add a punch list to the Lillie job: touch up hallway paint, missing outlet cover in the primary bath'. " +
      "Nothing is saved until the staff member confirms the card. Split the request into one item per fix, keep their wording and specifics, and put the room in location.",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", description: "Name or number of the Job, Pre-Con project or Pipeline deal (e.g. 'Lillie Residence', '26_030')" },
        target_type: { type: "string", enum: ["job", "precon", "deal"], description: "Only if the user said which kind; otherwise omit" },
        list_title: { type: "string", description: "Punch list title, e.g. 'Final Walkthrough' or 'Punch List'" },
        client_visible: { type: "boolean", description: "Only for Jobs, and only if the user asked for the client to see it" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              location: { type: "string", description: "Room or area" },
              trade: { type: "string" },
              priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
              due_date: { type: "string", description: "YYYY-MM-DD" },
              assignee: { type: "string", description: "Staff member's name, if the user assigned it" },
              notes: { type: "string" },
            },
            required: ["title"],
          },
        },
      },
      required: ["target", "items"],
    },
  },
};
