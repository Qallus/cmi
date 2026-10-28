// Commitments register (dashboard). Any staff member sees their own and what
// others are waiting on them for; Super Admin / Admin see everyone's.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createCommitment, listCommitments } from "@/lib/commitments/data";
import { commitmentsError } from "@/lib/commitments/http";

export const dynamic = "force-dynamic";

const ALL_ROLES = ["super_admin", "admin"];

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const q = new URL(request.url).searchParams;
    const scope = q.get("scope") ?? "mine";
    const status = q.get("status") ?? "open";
    const seeAll = ALL_ROLES.includes(staff.role_slug);
    const rows = await listCommitments({
      ownerId: scope === "mine" || (scope === "all" && !seeAll) ? staff.id : null,
      waitingOnStaffId: scope === "waiting_on_me" ? staff.id : null,
      status,
      limit: 300,
    });
    return NextResponse.json({ commitments: rows, canSeeAll: seeAll });
  } catch (err) {
    return commitmentsError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const { commitment } = await createCommitment(body ?? {}, staff, "dashboard");
    return NextResponse.json({ commitment });
  } catch (err) {
    return commitmentsError(err);
  }
}
