import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { PROGRESS_FLAG } from "@/lib/schedules/engine";
import { draftNarrative, finishUpdate, loadUpdate, postNarrative, pushTask, type FinishResult } from "@/lib/schedules/weekly-update-data";

// Weekly schedule update (Phase 2 Step 2, flag schedule_progress).
// GET: the tasks for this update (last status date → today).
// POST { action: "push", itemId, to, reason }: push a late task, reason logged.
// POST { action: "finish" }: status date → today, re-forecast, what moved.
// POST { action: "narrative", result }: Bolt's draft from the finished update.
// POST { action: "post_log", text }: the PM's text into today's daily log.
async function guard(request: Request) {
  const { user, staff } = await requireAdmin(request);
  if (!canEditSchedules(staff.role_slug)) throw Object.assign(new Error("Forbidden."), { status: 403 });
  if (!(await isFeatureEnabled(PROGRESS_FLAG))) throw Object.assign(new Error("Progress tracking is switched off."), { status: 403 });
  return { id: staff.id, name: staff.display_name ?? null, email: user.email ?? null };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guard(request);
    const { id } = await params;
    return NextResponse.json(await loadUpdate(id));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guard(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action === "push") {
      const to = String(body.to ?? "");
      const reason = String(body.reason ?? "").trim().slice(0, 300);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: "Pick the new start date." }, { status: 400 });
      if (!reason) return NextResponse.json({ error: "Say why it's being pushed." }, { status: 400 });
      return NextResponse.json(await pushTask(id, String(body.itemId ?? ""), to, reason, actor));
    }
    if (body.action === "finish") return NextResponse.json(await finishUpdate(id, actor));
    if (body.action === "narrative") {
      const r = body.result as FinishResult | undefined;
      if (!r?.to) return NextResponse.json({ error: "Finish the update first." }, { status: 400 });
      return NextResponse.json(await draftNarrative(id, { ...r, moved: (r.moved ?? []).slice(0, 200), critical: (r.critical ?? []).slice(0, 40) }));
    }
    if (body.action === "post_log") {
      const text = String(body.text ?? "").trim();
      if (!text) return NextResponse.json({ error: "There's nothing to post." }, { status: 400 });
      return NextResponse.json(await postNarrative(id, text.slice(0, 8000), actor));
    }
    return NextResponse.json({ error: "action must be push, finish, narrative or post_log." }, { status: 400 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
