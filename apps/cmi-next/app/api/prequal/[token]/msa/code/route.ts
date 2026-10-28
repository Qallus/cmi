// Email the signer a one-time code (proves control of the address they sign as).
import { NextResponse } from "next/server";
import { sendSigningCode } from "@/lib/prequal/msa";
import { PrequalError } from "@/lib/prequal/data";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const { token } = await params;
    const body = (await request.json().catch(() => ({}))) as { name?: string; title?: string; email?: string };
    const result = await sendSigningCode(token, { name: String(body.name ?? ""), title: body.title ?? null, email: String(body.email ?? "") });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const e = err as PrequalError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
