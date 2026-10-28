// The MSA step of the public application: current agreement link + signature state.
import { NextResponse } from "next/server";
import { msaStateForToken } from "@/lib/prequal/msa";
import { PrequalError } from "@/lib/prequal/data";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const { token } = await params;
    return NextResponse.json(await msaStateForToken(token));
  } catch (err) {
    const e = err as PrequalError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
