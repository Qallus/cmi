// Extract text from an uploaded training PDF so Bolt can read it. The file is
// already in the private bolt-training bucket; we download and parse it here
// (serverless-friendly via unpdf, no worker/binary setup).
import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Parsing a PDF can take a moment; keep it off the default short budget.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!["super_admin", "admin"].includes(staff.role_slug)) throw new AuthError("Forbidden — admin only.", 403);
  } catch (err) {
    const s = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status: s });
  }

  const { path } = (await request.json().catch(() => ({}))) as { path?: string };
  if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

  const { data, error } = await getSupabaseAdmin().storage.from("bolt-training").download(path);
  if (error || !data) return NextResponse.json({ error: "Could not read the uploaded file." }, { status: 404 });

  try {
    const bytes = new Uint8Array(await data.arrayBuffer());
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = (Array.isArray(text) ? text.join("\n\n") : text ?? "").trim();
    if (!merged) return NextResponse.json({ error: "No selectable text found (the PDF may be scanned images)." }, { status: 422 });
    return NextResponse.json({ text: merged.slice(0, 200_000) });
  } catch {
    return NextResponse.json({ error: "Could not extract text from this PDF." }, { status: 422 });
  }
}
