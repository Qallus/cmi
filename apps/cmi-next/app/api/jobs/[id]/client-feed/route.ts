import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadClientFeed } from "@/lib/jobs/client-feed";

// Everything the job's client sent, newest first, with what's waiting on the
// team. ?summary=1 returns only the counts (for the badges on every job page).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const summary = new URL(request.url).searchParams.get("summary") === "1";
    const feed = await loadClientFeed(id, { limit: summary ? 40 : 80 });
    return NextResponse.json(summary ? { open: feed.open, openBy: feed.openBy } : feed);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
