// One action applied to many deals.
//
// Reuses the same helpers the single-deal routes call, so a bulk stage change
// still records history and still runs the Closed Won handoff. A partial
// failure is reported rather than swallowed: a caller that asked for 12 and
// got 9 needs to know which three did not take.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canWriteDeals } from "@/lib/deals/roles";
import { archiveDeal, changeStage, deleteDeal, unarchiveDeal, updateDeal } from "@/lib/deals/data";
import { isDealStage } from "@/lib/deals/stages";

export const dynamic = "force-dynamic";
const MAX = 200;

type Action = "owner" | "stage" | "next_action" | "archive" | "restore" | "delete";

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) cannot change deals.` }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as
      | { ids?: string[]; action?: Action; value?: unknown; due?: string | null }
      | null;

    const ids = (body?.ids ?? []).filter((v): v is string => typeof v === "string");
    const action = body?.action;
    if (!ids.length) return NextResponse.json({ error: "Nothing selected." }, { status: 400 });
    if (ids.length > MAX) return NextResponse.json({ error: `Up to ${MAX} deals at a time.` }, { status: 400 });

    // Deleting in bulk is irreversible and takes the history with it, so it
    // keeps the same Super Admin bar as deleting one.
    if (action === "delete" && staff.role_slug !== "super_admin") {
      return NextResponse.json({ error: "Only a Super Admin can delete deals." }, { status: 403 });
    }
    if (action === "stage" && !isDealStage(body?.value)) {
      return NextResponse.json({ error: "A valid target stage is required." }, { status: 400 });
    }

    const actor = { id: staff.id, name: user.email };
    const failed: { id: string; error: string }[] = [];
    let done = 0;

    for (const id of ids) {
      try {
        switch (action) {
          case "owner":
            await updateDeal(id, { owner_id: (body?.value as string) || null }, actor);
            break;
          case "stage":
            await changeStage(id, body!.value as Parameters<typeof changeStage>[1], {}, actor, null);
            break;
          case "next_action":
            await updateDeal(id, {
              next_action: (body?.value as string) || null,
              next_action_due: body?.due || null,
            }, actor);
            break;
          case "archive":
            await archiveDeal(id, { id: staff.id });
            break;
          case "restore":
            // Not updateDeal: sanitizeDraft strips archived_at, so that
            // would silently do nothing.
            await unarchiveDeal(id, { id: staff.id });
            break;
          case "delete":
            await deleteDeal(id);
            break;
          default:
            return NextResponse.json({ error: "Unknown action." }, { status: 400 });
        }
        done += 1;
      } catch (err) {
        failed.push({ id, error: (err as Error).message });
      }
    }

    return NextResponse.json({ done, failed });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
