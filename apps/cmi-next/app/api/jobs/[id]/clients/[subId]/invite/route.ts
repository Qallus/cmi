// Invite a job's client to the portal: enable their portal access and email a
// set-account link. subId = job_contacts.id.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendClientInvite } from "@/lib/client-portal/notify";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id, subId } = await params;
    const sb = getSupabaseAdmin();

    const { data: jc } = await sb.from("job_contacts")
      .select("id, contact:contacts(first_name,email)").eq("id", subId).eq("job_id", id).maybeSingle();
    const contact = (jc as { contact: { first_name?: string; email?: string } | null } | null)?.contact;
    if (!contact?.email) return NextResponse.json({ error: "This client has no email on file." }, { status: 400 });

    const { data: job } = await sb.from("jobs").select("job_name").eq("id", id).maybeSingle();

    // Enable portal access for this client + ensure the job's portal is on.
    await sb.from("job_contacts").update({ portal_access_enabled: true }).eq("id", subId);
    await sb.from("jobs").update({ client_portal_enabled: true }).eq("id", id);

    const result = await sendClientInvite({ email: contact.email, firstName: contact.first_name ?? "", jobName: job?.job_name ?? "your project" });
    if (!result.ok) return NextResponse.json({ error: result.error ?? "Invite failed." }, { status: 502 });
    return NextResponse.json({ ok: true, email: contact.email });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
