import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, PREVIEW_MAX_AGE, signPreview } from "@/lib/client-portal/preview";
import { cookieOptions } from "@/lib/auth/tokens";

// GET ?contact=<contact id>: open the client portal for this job as that client
// contact, read-only, for 30 minutes (staff "Preview as client").
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    // Any staff member: a preview only shows what the client already sees.
    const { id } = await params;
    const contactId = new URL(request.url).searchParams.get("contact") ?? "";
    const { data } = await getSupabaseAdmin().from("job_contacts").select("contact_id").eq("job_id", id).eq("contact_id", contactId).maybeSingle();
    if (!data) return NextResponse.json({ error: "That contact isn't on this job." }, { status: 404 });
    const res = NextResponse.redirect(new URL(`/client/jobs/${id}`, request.url));
    res.cookies.set(PREVIEW_COOKIE, signPreview({ jobId: id, contactId, staffId: staff.id }), cookieOptions(PREVIEW_MAX_AGE));
    return res;
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
