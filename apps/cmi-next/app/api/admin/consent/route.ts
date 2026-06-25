// Admin management of SMS/email consent: counts, people list, and single/bulk
// opt-in / opt-out.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { applyConsent, loadConsentSummary, type Channel, type ConsentAction } from "@/lib/messaging/consent";

const ADMIN = ["super_admin", "admin"];

export async function GET(request: Request) {
  let staff;
  try { ({ staff } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
  if (!ADMIN.includes(staff.role_slug)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  try {
    const summary = await loadConsentSummary();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let staff;
  try { ({ staff } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
  if (!ADMIN.includes(staff.role_slug)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null) as
    | { channel?: Channel; action?: ConsentAction; targets?: { address: string; recordType?: string; recordId?: string }[] }
    | null;
  const channel = body?.channel;
  const action = body?.action;
  const targets = body?.targets ?? [];
  if (channel !== "sms" && channel !== "email") return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  if (action !== "opt_in" && action !== "opt_out") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  if (!targets.length) return NextResponse.json({ error: "No targets." }, { status: 400 });

  let applied = 0;
  for (const t of targets) {
    if (!t.address) continue;
    const r = await applyConsent({
      channel, action, address: t.address, source: "dashboard",
      recordType: t.recordType, recordId: t.recordId ?? null, actorStaffId: staff.id,
    });
    if ("ok" in r) applied += 1;
  }
  return NextResponse.json({ ok: true, applied });
}
