// Begin a prequalification application. Public and unauthenticated by design:
// the applicant has no CMI account. The returned token is the credential for
// the draft, so it is long and random.
import { NextResponse } from "next/server";
import { startApplication } from "@/lib/prequal/data";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const app = await startApplication({
      sourceUrl: request.headers.get("referer"),
      ip: forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ token: app.token }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start." }, { status: 500 });
  }
}
