// Bolt ↔ punch lists. Bolt never saves punch items directly: it resolves the
// Job / Pre-Con / Pipeline record and stages the list for the staff member to
// confirm (PendingAction kind "punch_list"), then executePunchPending saves it.
// Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { addItems, createList, listTemplates, searchTargets } from "./data";
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
  template?: string;
  client_visible?: boolean;
  items?: { title?: string; location?: string; trade?: string; priority?: string; due_date?: string; assignee?: string; notes?: string }[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// "CM-2026-0007 · 26_030_Lillie Residence" and "26_030_Lillie Residence" → "lillieresidence"
const baseName = (label: string) => norm(label.replace(/CM-\d{4}-\d{4}/g, "").replace(/\d{2}_\d{3}_?/g, ""));

// Search by the whole phrase, then by its significant words ("the Lillie job" → "Lillie").
async function findTargets(target: string, type: PunchParentType | null): Promise<PunchParent[]> {
  const ofType = (list: PunchParent[]) => list.filter((m) => !type || m.type === type);
  let matches = ofType(await searchTargets(target));
  if (matches.length) return matches;
  const words = target.split(/[\s,]+/).filter((w) => w.length >= 3 && !/^(the|job|jobs|project|residence|house|home|precon|pre-con|deal|pipeline|list|punch)$/i.test(w));
  for (const w of words) {
    const hits = ofType(await searchTargets(w));
    matches = matches.length ? matches.filter((m) => hits.some((h) => h.id === m.id)) : hits;
    if (!matches.length) break;
  }
  return matches;
}

export async function stagePunchList(args: Args, role: string): Promise<
  { ok: true; pending: PunchPending; summary: string } | { ok: false; result: Record<string, unknown> }
> {
  if (!canWritePunch(role)) return { ok: false, result: { error: `Your role (${role}) can't add punch lists.` } };
  const target = (args.target ?? "").trim();
  if (!target) return { ok: false, result: { error: "Which Job, Pre-Con project or Pipeline deal should the punch list go on? Ask the user." } };

  // A template ("kitchen punch list") seeds the items; spoken items are added on top.
  // An empty list is fine too — the confirmation card lets the user add items.
  let templateItems: NonNullable<Args["items"]> = [];
  let templateName: string | null = null;
  if (args.template?.trim()) {
    const want = norm(args.template.replace(/punch\s*list|template/gi, ""));
    const all = await listTemplates();
    const t = all.find((x) => norm(x.name) === want)
      ?? all.find((x) => norm(x.name).includes(want) || (want && want.includes(norm(x.name))));
    if (t) {
      templateName = t.name;
      templateItems = t.items.map((i) => ({ title: i.title, location: i.location ?? undefined, trade: i.trade ?? undefined }));
    }
  }
  const items = [...templateItems, ...(args.items ?? [])]
    .filter((i) => typeof i?.title === "string" && i.title.trim())
    .slice(0, 200);

  // Find the record. A UUID is used as-is; otherwise search by name/number,
  // then by its significant words ("the Lillie job" → "Lillie").
  const type = (["job", "precon", "deal"] as const).includes(args.target_type as PunchParentType) ? (args.target_type as PunchParentType) : null;
  let matches = await findTargets(target, type);
  // Said "job" but the project is still in Pre-Con (or only a deal)? Use what exists.
  if (!matches.length && type) matches = await findTargets(target, null);
  if (/^[0-9a-f-]{36}$/i.test(target)) matches = matches.filter((m) => m.id === target);
  const exact = matches.filter((m) => norm(m.label) === norm(target));
  if (exact.length === 1) matches = exact;
  // One project at several stages (its Pipeline deal, Pre-Con record and Job
  // share a name): use the furthest along rather than asking.
  if (matches.length > 1 && new Set(matches.map((m) => baseName(m.label))).size === 1) {
    const rank: Record<PunchParentType, number> = { job: 3, precon: 2, deal: 1 };
    const top = Math.max(...matches.map((m) => rank[m.type]));
    const best = matches.filter((m) => rank[m.type] === top);
    if (best.length === 1) matches = best;
  }
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
  const listTitle = (args.list_title ?? "").trim() || templateName || "Punch List";
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
    if (!p.items.length) return { ok: true, added: 0, list_id: p.list_id, message: "Nothing to add." };
    const added = await addItems(p.list_id, p.items, actor);
    return { ok: true, added: added.length, list_id: p.list_id, message: `Added ${added.length} item${added.length === 1 ? "" : "s"}.` };
  }
  const list = await createList({
    parent_type: p.parent_type, parent_id: p.parent_id, title: p.list_title,
    client_visible: p.client_visible, items: p.items,
  }, actor);
  return { ok: true, created: list.id, items: list.items.length, message: `Created “${list.title}” with ${list.items.length} item${list.items.length === 1 ? "" : "s"}.` };
}

export const PUNCH_TOOL_DEF = {
  type: "function",
  function: {
    name: "propose_punch_list",
    description:
      "Add punch list items to a Job, Pre-Con project or Pipeline deal (creates a new punch list, or adds to an existing list with the same title on that record). " +
      "Use when someone dictates or lists fixes/tasks for a walkthrough, e.g. 'add a punch list to the Lillie job: touch up hallway paint, missing outlet cover in the primary bath'. " +
      "Call this AS SOON AS you know which record it goes on — do not first ask about the list title, items, assignees, priorities or due dates: the confirmation card lets the user add/edit items and assign each one before saving. " +
      "Items are optional (an empty list is fine) and a built-in template can seed them (template: Final Walkthrough, Pre-Drywall, Kitchen, Bathroom, Exterior & Landscape, Project Closeout). " +
      "Nothing is saved until the staff member confirms the card. Split spoken items into one per fix, keep their wording and specifics, and put the room in location.",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", description: "Name or number of the Job, Pre-Con project or Pipeline deal (e.g. 'Lillie Residence', '26_030')" },
        target_type: { type: "string", enum: ["job", "precon", "deal"], description: "Only if the user said which kind; otherwise omit" },
        list_title: { type: "string", description: "Punch list title, e.g. 'Final Walkthrough' or 'Punch List'. Optional." },
        template: { type: "string", description: "Optional built-in or saved template to start from, e.g. 'Kitchen', 'Final Walkthrough', 'Pre-Drywall', 'Bathroom', 'Exterior & Landscape', 'Project Closeout'" },
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
      required: ["target"],
    },
  },
};
