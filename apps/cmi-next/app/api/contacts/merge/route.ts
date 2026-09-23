// Duplicate review: list the groups, and fold one into another.
import { NextResponse } from "next/server";
import { getStaffSession, denyUnlessStaff } from "@/lib/auth/guard";
import { findDuplicateGroups, mergeContacts } from "@/lib/contacts/merge";

export const dynamic = "force-dynamic";

const MERGE_ROLES = ["super_admin", "admin"];

export async function GET() {
  const denied = await denyUnlessStaff(); if (denied) return denied;
  try {
    return NextResponse.json({ groups: await findDuplicateGroups() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load duplicates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Merging deletes a record and moves its history; keep it to the roles that
  // can already delete things.
  const denied = await denyUnlessStaff(MERGE_ROLES); if (denied) return denied;

  try {
    const { staff } = await getStaffSession();
    const body = await request.json().catch(() => ({}));
    const survivorId = typeof body?.survivor_id === "string" ? body.survivor_id : null;
    const loserIds = Array.isArray(body?.loser_ids)
      ? body.loser_ids.filter((v: unknown): v is string => typeof v === "string")
      : [];
    if (!survivorId) return NextResponse.json({ error: "Choose which contact to keep." }, { status: 400 });

    const result = await mergeContacts(survivorId, loserIds, {
      patch: body?.patch && typeof body.patch === "object" ? body.patch : undefined,
      actorId: staff.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Merge failed." }, { status: 500 });
  }
}
