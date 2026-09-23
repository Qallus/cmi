// Submit the application: create or match the company and contact, promote the
// structured profile, and open the compliance rows.
import { NextResponse } from "next/server";
import { submitApplication, PrequalError } from "@/lib/prequal/data";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const { token } = await params;
    const forwarded = request.headers.get("x-forwarded-for");
    const app = await submitApplication(token, {
      ip: forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, status: app.status, company_id: app.company_id });
  } catch (err) {
    const e = err as PrequalError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
