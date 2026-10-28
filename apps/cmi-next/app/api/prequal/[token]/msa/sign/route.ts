// Verify the emailed code and sign: records consent, identity evidence and the
// drawn signature, and builds the signed MSA PDF.
import { NextResponse } from "next/server";
import { completeSignature } from "@/lib/prequal/msa";
import { PrequalError } from "@/lib/prequal/data";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const { token } = await params;
    const body = (await request.json().catch(() => ({}))) as { code?: string; consent?: boolean; signature?: string };
    const forwarded = request.headers.get("x-forwarded-for");
    const result = await completeSignature(token, {
      code: String(body.code ?? ""),
      consent: body.consent === true,
      signaturePngBase64: typeof body.signature === "string" ? body.signature : null,
      ip: forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const e = err as PrequalError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
