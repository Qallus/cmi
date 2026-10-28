// MSA versions (upload, make current) and recent signatures (Trade Partners → Setup).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePrequal, requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { addMsaVersion, listMsaVersions, setCurrentMsa, signedUrl } from "@/lib/prequal/msa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    const versions = await listMsaVersions();
    const { data: sigs } = await getSupabaseAdmin().from("msa_signatures")
      .select("id, company_id, application_id, msa_version_id, signer_name, signer_title, signer_email, signed_at, signed_pdf_path, countersigner_name, countersigned_at, companies(name)")
      .not("signed_at", "is", null).order("signed_at", { ascending: false }).limit(100);
    return NextResponse.json({
      versions: await Promise.all(versions.map(async (v) => ({ ...v, url: await signedUrl(v.storage_path, 600) }))),
      signatures: await Promise.all((sigs ?? []).map(async (s) => ({
        ...s,
        company_name: (s as unknown as { companies?: { name?: string } | null }).companies?.name ?? null,
        version_label: versions.find((v) => v.id === s.msa_version_id)?.label ?? null,
        pdf_url: s.signed_pdf_path ? await signedUrl(s.signed_pdf_path, 600) : null,
      }))),
    });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { staff } = await requirePrequalDecide(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose the MSA PDF." }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "That file is larger than 25 MB." }, { status: 413 });
    const version = await addMsaVersion({
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      label: String(form.get("label") ?? ""),
      effectiveAt: String(form.get("effective_at") ?? "") || null,
      makeCurrent: form.get("make_current") === "true",
      staffId: staff.id,
    });
    return NextResponse.json({ ok: true, version }, { status: 201 });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePrequalDecide(request);
    const { id } = (await request.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Which version?" }, { status: 400 });
    await setCurrentMsa(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
