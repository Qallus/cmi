import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendEditCompletedEmails, type CompletedEdit } from "@/lib/project-manager/notify";

type StoredEdit = CompletedEdit & { status?: string; notified_at?: string };

function readEdits(metadata: unknown): StoredEdit[] {
  const raw = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).website_edits : null;
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is StoredEdit => Boolean(entry) && typeof entry === "object");
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // When website-edit requests are part of this update, look for any that just
    // flipped to "done" so we can email the task participants (the owners).
    if (body.metadata && typeof body.metadata === "object") {
      const { data: existing } = await supabase
        .from("project_schedule_items")
        .select("metadata, participants, notify, title, project_title, schedule_group_key")
        .eq("id", id)
        .single();

      const previousById = new Map(readEdits(existing?.metadata).map(edit => [edit.id, edit]));
      const nextEdits = readEdits(body.metadata);
      const notifyEnabled = body.notify !== undefined ? Boolean(body.notify) : Boolean(existing?.notify);
      const participantsRaw = body.participants !== undefined ? String(body.participants || "") : String(existing?.participants || "");
      const recipientNames = participantsRaw.split(",").map(value => value.trim()).filter(Boolean);
      const pageTitle = body.title !== undefined ? String(body.title || "") : String(existing?.title || "Page");
      const projectTitle = (body.project_title ?? existing?.project_title ?? existing?.schedule_group_key) || null;

      if (notifyEnabled && recipientNames.length) {
        for (const edit of nextEdits) {
          const prior = previousById.get(edit.id);
          const justCompleted = edit.status === "done" && prior?.status !== "done" && !edit.notified_at;
          if (!justCompleted) continue;
          const { sent } = await sendEditCompletedEmails({ projectTitle, pageTitle, edit, recipientNames });
          // Stamp so re-saving the task never re-sends this notification.
          if (sent > 0) edit.notified_at = new Date().toISOString();
        }
      }
    }

    const { data, error } = await supabase
      .from("project_schedule_items")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Schedule item update failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("project_schedule_items").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Schedule item delete failed" }, { status: 500 });
  }
}
