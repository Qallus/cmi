import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  loadPageReview, saveNote, updateNote, deleteNote, loadSessionBundle, recordExport,
} from "@/lib/live-editor/data";
import { buildStructuredExport, buildMarkdown, buildAiBrief, buildPrintableHtml } from "@/lib/live-editor/export";
import type { SaveNoteInput } from "@/lib/live-editor/types";

function authFail(err: unknown) {
  const e = err as AuthError;
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
  } catch (err) {
    return authFail(err) ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const pageSlug = req.nextUrl.searchParams.get("page_slug");
    if (!pageSlug) return NextResponse.json({ error: "page_slug is required." }, { status: 400 });
    const review = await loadPageReview(pageSlug);
    return NextResponse.json(review);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load review." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let email = "";
  try {
    const { user } = await requireSuperAdmin(req);
    email = user.email ?? "";
  } catch (err) {
    return authFail(err) ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null) as { action?: string; [k: string]: unknown } | null;
    if (!body?.action) return NextResponse.json({ error: "action is required." }, { status: 400 });

    switch (body.action) {
      case "save_note": {
        const input = body.payload as SaveNoteInput;
        if (!input?.note?.trim()) return NextResponse.json({ error: "Note text is required." }, { status: 400 });
        if (!input.element?.element_ref) return NextResponse.json({ error: "An element must be selected." }, { status: 400 });
        const result = await saveNote(input, email);
        return NextResponse.json(result, { status: 201 });
      }
      case "update_note": {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> };
        if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });
        const note = await updateNote(id, patch ?? {});
        return NextResponse.json({ note });
      }
      case "delete_note": {
        const { id } = body as { id?: string };
        if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });
        await deleteNote(id);
        return NextResponse.json({ ok: true });
      }
      case "export":
      case "send_to_bolt": {
        const { session_id } = body as { session_id?: string };
        if (!session_id) return NextResponse.json({ error: "session_id is required." }, { status: 400 });
        const bundle = await loadSessionBundle(session_id);
        if (!bundle) return NextResponse.json({ error: "Review session not found." }, { status: 404 });
        const structured = buildStructuredExport(bundle);
        const markdown = buildMarkdown(structured);
        const aiBrief = buildAiBrief(structured);
        const html = buildPrintableHtml(structured);
        const aiVisible = body.action === "send_to_bolt";
        const exportId = await recordExport({
          sessionId: session_id,
          fileType: aiVisible ? "ai_brief" : "markdown",
          payload: { structured, markdown, aiBrief },
          createdBy: email,
          aiVisible,
        });
        return NextResponse.json({ exportId, structured, markdown, aiBrief, html, aiVisible });
      }
      default:
        return NextResponse.json({ error: `Unknown action "${body.action}".` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Request failed." }, { status: 500 });
  }
}
