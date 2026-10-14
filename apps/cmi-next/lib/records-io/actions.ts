// Route handlers behind the Pre-Con / Jobs checkbox quick-action bar: one
// action applied to many records, and Email/SMS/Message sharing. Mirrors
// /api/deals/bulk — each record goes through the same helper a single edit
// uses, and partial failures are reported, not swallowed.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canWriteDeals } from "@/lib/deals/roles";
import { DealShareError } from "@/lib/deals/notify";
import { deleteOpportunity, setOpportunityArchived, transitionStage, updateOpportunity, TransitionError } from "@/lib/pipeline/data";
import { ALL_STAGES } from "@/lib/pipeline/stages";
import type { PipelineStage } from "@/lib/pipeline/types";
import { archiveJob, deleteJob, restoreJob, updateJob } from "@/lib/jobs/data";
import { ALL_JOB_STATUSES } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/types";
import { shareRecord } from "./share";
import { DELETE_ROLES, WRITE_ROLES, type RecordTarget } from "./fields";


const MAX = 200;
type Action = "stage" | "next_action" | "archive" | "restore" | "delete";
const NOUN: Record<RecordTarget, string> = { precon: "opportunities", jobs: "jobs" };

function fail(err: unknown) {
  const e = err as AuthError;
  return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
}

export async function handleBulk(target: RecordTarget, request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES[target].includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't change ${NOUN[target]}.` }, { status: 403 });
    }
    const body = await request.json().catch(() => null) as
      | { ids?: string[]; action?: Action; value?: unknown; due?: string | null } | null;
    const ids = (body?.ids ?? []).filter((v): v is string => typeof v === "string");
    const action = body?.action;
    if (!ids.length) return NextResponse.json({ error: "Nothing selected." }, { status: 400 });
    if (ids.length > MAX) return NextResponse.json({ error: `Up to ${MAX} at a time.` }, { status: 400 });
    if (action === "delete" && !DELETE_ROLES[target].includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't delete ${NOUN[target]}.` }, { status: 403 });
    }
    const stages: readonly string[] = target === "precon" ? ALL_STAGES : ALL_JOB_STATUSES;
    if (action === "stage" && !stages.includes(String(body?.value))) {
      return NextResponse.json({ error: "A valid stage is required." }, { status: 400 });
    }

    const actor = { id: staff.id, name: user.email };
    const failed: { id: string; error: string }[] = [];
    let done = 0;

    for (const id of ids) {
      try {
        const nextAction = { next_action: (body?.value as string)?.trim() || null, next_action_due: body?.due || null };
        if (target === "precon") {
          switch (action) {
            // Through the transition guard, so the path and required fields
            // are checked and the stage history is written.
            case "stage": await transitionStage(id, body!.value as PipelineStage, {}, actor, "Changed from the Pre-Con list"); break;
            case "next_action": await updateOpportunity(id, nextAction, actor); break;
            case "archive": await setOpportunityArchived(id, true); break;
            case "restore": await setOpportunityArchived(id, false); break;
            case "delete": await deleteOpportunity(id); break;
            default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
          }
        } else {
          switch (action) {
            case "stage": await updateJob(id, { status: body!.value as JobStatus }, actor); break;
            case "next_action": await updateJob(id, nextAction, actor); break;
            case "archive": await archiveJob(id, actor); break;
            case "restore": await restoreJob(id, actor); break;
            case "delete": await deleteJob(id); break;
            default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
          }
        }
        done += 1;
      } catch (err) {
        const missing = err instanceof TransitionError && err.missing.length ? ` Missing: ${err.missing.join(", ")}.` : "";
        failed.push({ id, error: `${(err as Error).message}${missing}` });
      }
    }
    return NextResponse.json({ done, failed });
  } catch (err) {
    return fail(err);
  }
}

export async function handleShare(target: RecordTarget, request: Request, id: string) {
  try {
    const { staff, user } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't share ${NOUN[target]}.` }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const recipient_ids = Array.isArray(body?.recipient_ids)
      ? body.recipient_ids.filter((v: unknown): v is string => typeof v === "string")
      : [];
    return NextResponse.json(await shareRecord(
      target, id,
      { channel: body?.channel, recipient_ids, note: typeof body?.note === "string" ? body.note : null },
      { id: staff.id, name: user.email ?? null },
    ));
  } catch (err) {
    if (err instanceof DealShareError) return NextResponse.json({ error: err.message }, { status: err.status });
    return fail(err);
  }
}
