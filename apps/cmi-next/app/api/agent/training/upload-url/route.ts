// Signed upload URL for storing the original training file (reference copy).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";
}

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!["super_admin", "admin"].includes(staff.role_slug)) throw new AuthError("Forbidden — admin only.", 403);
  } catch (err) {
    const s = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status: s });
  }

  const { filename } = (await request.json().catch(() => ({}))) as { filename?: string };
  const path = `${Date.now()}-${crypto.randomUUID()}-${safeName(filename ?? "upload")}`;
  const { data, error } = await getSupabaseAdmin().storage.from("bolt-training").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create upload URL." }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl });
}
