// What the punch list UI needs once: who can be assigned items, the templates,
// and whether the current user can edit.
import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/punch/data";
import { punchError, punchSession } from "@/lib/punch/api";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { canWritePunch } from "@/lib/punch/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff } = await punchSession(request, false);
    const [people, templates] = await Promise.all([loadAssignableStaff(), listTemplates()]);
    return NextResponse.json({
      me: staff.id,
      canWrite: canWritePunch(staff.role_slug as string),
      staff: people.map((p) => ({ id: p.id, name: p.name })),
      templates,
    });
  } catch (err) {
    return punchError(err);
  }
}
