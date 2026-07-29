// Signed download URL for a training document's stored original file.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!["super_admin", "admin"].includes(staff.role_slug)) throw new AuthError("Forbidden — admin only.", 403);
  } catch (err) {
    const s = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status: s });
  }

  const { path, download } = (await request.json().catch(() => ({}))) as { path?: string; download?: string };
  if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

  const { data, error } = await getSupabaseAdmin().storage
    .from("bolt-training")
    .createSignedUrl(path, 3600, download ? { download } : undefined);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Could not sign this file." }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
