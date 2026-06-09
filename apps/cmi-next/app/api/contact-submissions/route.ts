import { NextRequest, NextResponse } from "next/server";
import { loadContactSubmissions, updateContactSubmissionStatus } from "@/lib/contact-submissions/data";
import type { ContactSubmissionStatus } from "@/lib/contact-submissions/types";

export async function GET() {
  try {
    const submissions = await loadContactSubmissions(500);
    return NextResponse.json(submissions);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load submissions." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json() as { id: string; status: ContactSubmissionStatus };
    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required." }, { status: 400 });
    }
    await updateContactSubmissionStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update submission." },
      { status: 500 }
    );
  }
}
