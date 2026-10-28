// The Trade Partner Onboarding Guide PDF attached to approval emails.
import { NextResponse } from "next/server";
import { requirePrequal, requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { onboardingGuide, saveOnboardingGuide } from "@/lib/prequal/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    return NextResponse.json({ url: (await onboardingGuide()).url });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    await requirePrequalDecide(request);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose the guide PDF." }, { status: 400 });
    await saveOnboardingGuide(file);
    return NextResponse.json({ ok: true, url: (await onboardingGuide()).url });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
