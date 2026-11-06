import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { assignTasks } from "@/lib/schedules/resources-data";
import type { Assignee } from "@/lib/schedules/types";

const TYPES = new Set(["staff", "vendor", "contractor", "client", "trade"]);

// POST { itemIds, resources: [{ id, name, type }], mode: add | replace | remove }:
// assign several tasks at once (the grid's Assign…).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const b = (await request.json().catch(() => ({}))) as { itemIds?: unknown; resources?: unknown; mode?: unknown };
    const itemIds = (Array.isArray(b.itemIds) ? b.itemIds : []).filter((x): x is string => typeof x === "string");
    const resources = (Array.isArray(b.resources) ? b.resources : []).filter((r): r is Assignee =>
      !!r && typeof (r as Assignee).id === "string" && typeof (r as Assignee).name === "string" && TYPES.has((r as Assignee).type ?? "staff"))
      .map((r) => ({ id: r.id.slice(0, 80), name: r.name.slice(0, 120), type: r.type ?? "staff" }));
    const mode = b.mode === "replace" || b.mode === "remove" ? b.mode : "add";
    if (!itemIds.length) return NextResponse.json({ error: "Select the tasks first." }, { status: 400 });
    if (!resources.length && mode !== "replace") return NextResponse.json({ error: "Pick who to assign." }, { status: 400 });
    return NextResponse.json({ updated: await assignTasks(id, itemIds, resources, mode, { id: staff.id, name: staff.display_name ?? null }) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
