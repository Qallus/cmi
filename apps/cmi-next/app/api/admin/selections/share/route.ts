import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function text(value: unknown) {
  const next = String(value || "").trim();
  return next || null;
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const resourceType = String(body.resource_type || "");
    const resourceId = text(body.resource_id);
    const channel = String(body.channel || "");
    if (!["product", "selection"].includes(resourceType)) throw new Error("Share resource type is required.");
    if (!resourceId) throw new Error("Share resource is required.");
    if (!["email", "sms", "link"].includes(channel)) throw new Error("Share channel is required.");

    const { data, error } = await supabase
      .from("selection_share_events")
      .insert({
        resource_type: resourceType,
        resource_id: resourceId,
        channel,
        recipient_name: text(body.recipient_name),
        recipient_email: text(body.recipient_email),
        recipient_phone: text(body.recipient_phone),
        recipient_type: text(body.recipient_type) || "other",
        subject: text(body.subject),
        message: text(body.message),
        share_url: text(body.share_url),
        status: channel === "link" ? "sent" : "queued",
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ share: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Share request failed." }, { status: 400 });
  }
}
