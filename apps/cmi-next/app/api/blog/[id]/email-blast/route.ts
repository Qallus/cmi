import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      recipients: "contacts" | "staff" | "subscribers" | "all" | "manual";
      recipient_emails?: string[];
      subject: string;
      when: "now" | "scheduled";
      scheduled_at: string | null;
    };

    const supabase = getSupabaseAdmin();

    // Load the post
    const { data: post, error: postErr } = await supabase
      .from("blog_posts")
      .select("id, title, content, excerpt, slug, featured_image")
      .eq("id", id)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    // Resolve recipient emails based on selection
    let emails: string[] = [];
    const manualEmails = (body.recipient_emails ?? [])
      .map(email => String(email || "").trim().toLowerCase())
      .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (body.recipients === "contacts" || body.recipients === "all") {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("email")
        .eq("status", "active");
      emails.push(...(contacts ?? []).map((c: { email: string }) => c.email).filter(Boolean));
    }

    if (body.recipients === "staff" || body.recipients === "all") {
      const { data: staff } = await supabase
        .from("staff_users")
        .select("users(email)")
        .eq("is_active", true);
      const staffEmails = (staff ?? [])
        .flatMap((s: { users: { email: string }[] }) => s.users ?? [])
        .map((u: { email: string }) => u.email)
        .filter(Boolean) as string[];
      emails.push(...staffEmails);
    }

    if (body.recipients === "subscribers" || body.recipients === "all") {
      // Subscribers from contacts tagged as subscriber
      const { data: subs } = await supabase
        .from("contacts")
        .select("email")
        .contains("tags", ["subscriber"]);
      emails.push(...(subs ?? []).map((c: { email: string }) => c.email).filter(Boolean));
    }

    if (body.recipients === "manual" || manualEmails.length > 0) {
      emails.push(...manualEmails);
    }

    // Deduplicate
    emails = [...new Set(emails)];

    if (emails.length === 0) {
      return NextResponse.json({ error: "No recipients found for the selected audience." }, { status: 400 });
    }

    // Log to integration_logs — actual Resend batch send would go here
    const logPayload = {
      post_id: id,
      subject: body.subject || post.title,
      recipients: body.recipients,
      recipient_emails: manualEmails,
      recipient_count: emails.length,
      when: body.when,
      scheduled_at: body.scheduled_at,
    };

    await supabase.from("integration_logs").insert({
      provider: "resend",
      direction: "outbound",
      entity_type: "blog_posts",
      entity_id: id,
      action: "email_blast_queued",
      source: "blog_email_blast",
      event_type: "email_blast_queued",
      payload: logPayload,
      request_payload: logPayload,
      status: "queued",
      message: `Queued blog email blast for ${emails.length} recipient${emails.length === 1 ? "" : "s"}.`,
    }).throwOnError();

    return NextResponse.json({
      ok: true,
      recipient_count: emails.length,
      when: body.when,
    });
  } catch (err) {
    console.error("[api/blog/email-blast]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to queue email blast." },
      { status: 500 }
    );
  }
}
