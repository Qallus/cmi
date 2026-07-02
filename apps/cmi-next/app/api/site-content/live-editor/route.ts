import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  loadPageReview, saveNote, updateNote, deleteNote, loadSessionBundle, recordExport,
  listSessions, updateSession, deleteSession, recordNotification,
} from "@/lib/live-editor/data";
import { buildStructuredExport, buildMarkdown, buildAiBrief, buildPrintableHtml } from "@/lib/live-editor/export";
import { buildStatusEmailHtml, sendReviewNotification } from "@/lib/live-editor/notify";
import { SESSION_STATUS_LABELS, type SaveNoteInput, type SessionStatus } from "@/lib/live-editor/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";

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
    if (req.nextUrl.searchParams.get("list") === "sessions") {
      return NextResponse.json({ sessions: await listSessions() });
    }
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
      case "update_session": {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> };
        if (!id) return NextResponse.json({ error: "session_id is required." }, { status: 400 });
        const session = await updateSession(id, patch ?? {});
        return NextResponse.json({ session });
      }
      case "delete_session": {
        const { id } = body as { id?: string };
        if (!id) return NextResponse.json({ error: "session_id is required." }, { status: 400 });
        await deleteSession(id);
        return NextResponse.json({ ok: true });
      }
      case "notify_requester": {
        const { session_id, to_email, status, message } = body as
          { session_id?: string; to_email?: string; status?: SessionStatus; message?: string };
        if (!session_id) return NextResponse.json({ error: "session_id is required." }, { status: 400 });

        // Optionally advance the request status first, then notify.
        if (status) await updateSession(session_id, { status });
        const bundle = await loadSessionBundle(session_id);
        if (!bundle) return NextResponse.json({ error: "Review session not found." }, { status: 404 });

        const toEmail = (to_email || bundle.session.requester_email || bundle.session.created_by || "").trim();
        if (!toEmail) return NextResponse.json({ error: "No requester email on this review. Add one first." }, { status: 400 });

        const statusLabel = SESSION_STATUS_LABELS[(bundle.session.status as SessionStatus)] ?? bundle.session.status;
        const structured = buildStructuredExport(bundle);
        const editorUrl = `${APP_URL}/dashboard/site-content/live-editor?page=${encodeURIComponent(bundle.session.page_slug)}`;
        const subject = `Page review ${statusLabel}: ${bundle.session.page_title ?? bundle.session.page_slug}`;
        const html = buildStatusEmailHtml({ session: bundle.session, data: structured, statusLabel, editorUrl, note: message });

        const sent = await sendReviewNotification({ toEmail, subject, html });
        await recordNotification({
          sessionId: session_id, toEmail, toName: bundle.session.requester_name ?? null,
          subject, body: message ?? "", statusSnapshot: bundle.session.status,
          provider: "resend", providerId: sent.id, error: sent.error, sentBy: email,
        });
        if (!sent.ok) return NextResponse.json({ error: sent.error ?? "Notification failed." }, { status: 502 });
        return NextResponse.json({ ok: true, to: toEmail, status: bundle.session.status });
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
