// Self-service: a logged-in staff member reads/updates THEIR OWN team profile
// (matched by email). Restricted to safe fields; can't touch others' records.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadTeamMemberByEmail, updateOwnTeamProfile } from "@/lib/team/data";

export async function GET(request: NextRequest) {
  let user;
  try { ({ user } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
  if (!user.email) return NextResponse.json({ profile: null });
  const profile = await loadTeamMemberByEmail(user.email);
  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest) {
  let user;
  try { ({ user } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
  if (!user.email) return NextResponse.json({ error: "No email on session." }, { status: 400 });

  const patch = await request.json().catch(() => null);
  if (!patch) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  try {
    const updated = await updateOwnTeamProfile(user.email, patch);
    if (!updated) return NextResponse.json({ error: "No team profile is linked to your account. Ask an admin to add you in Dashboard → Team with this email." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 400 });
  }
}
