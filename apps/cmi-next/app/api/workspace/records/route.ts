import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Hit = { recordType: string; recordId: string; label: string; sublabel: string | null; href: string };

// Record-link source for the Project Tracker "Connect" picker and the `#`/record
// link block. Remapped from MJG (plans/participants/booking_events) to CMI's real
// features:
//   plan       -> CMI Projects (project-manager)   [supports create]
//   project    -> CMI Jobs                          [link existing]
//   participant-> CMI Contacts
//   booking    -> CMI Bookings
//   workspace  -> Workspace documents

// Create a real CMI Project so a Project Tracker row lives in both Workspace and Projects.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireWorkspaceAccess(request, body.actionToken);
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });
    if (body.type !== "plan") return NextResponse.json({ error: "Only projects can be created here." }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("projects").insert({ title: name }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, recordId: data.id, label: name, href: `/dashboard/project-manager` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create record.";
    const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    await requireWorkspaceAccess(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "plan";
    const q = (url.searchParams.get("q") ?? "").trim();
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const supabase = createSupabaseAdminClient();
    const results: Hit[] = [];

    if (type === "plan") {
      // CMI Projects (project-manager)
      let query = supabase.from("projects").select("id,title,status").order("updated_at", { ascending: false }).limit(20);
      if (q) query = query.ilike("title", like);
      const { data } = await query;
      for (const r of data ?? []) results.push({ recordType: "plan", recordId: r.id, label: r.title || "Untitled project", sublabel: r.status ?? null, href: `/dashboard/project-manager` });
    } else if (type === "participant") {
      // CMI Contacts
      let query = supabase.from("contacts").select("id,first_name,last_name,email").order("created_at", { ascending: false }).limit(20);
      if (q) query = query.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
      const { data } = await query;
      for (const r of data ?? []) results.push({ recordType: "participant", recordId: r.id, label: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.email || "Contact", sublabel: r.email ?? null, href: `/dashboard/contacts` });
    } else if (type === "booking") {
      // CMI Bookings
      let query = supabase.from("bookings").select("id,title,status,start_datetime").order("start_datetime", { ascending: false }).limit(20);
      if (q) query = query.ilike("title", like);
      const { data } = await query;
      for (const r of data ?? []) results.push({ recordType: "booking", recordId: r.id, label: r.title || "Booking", sublabel: r.start_datetime ? new Date(r.start_datetime).toLocaleDateString() : (r.status ?? null), href: `/dashboard/bookings` });
    } else if (type === "project") {
      // CMI Jobs (operational containers)
      let query = supabase.from("jobs").select("id,job_name,job_number,status").order("updated_at", { ascending: false }).limit(20);
      if (q) query = query.or(`job_name.ilike.${like},job_number.ilike.${like}`);
      const { data } = await query;
      for (const r of data ?? []) results.push({ recordType: "project", recordId: r.id, label: [r.job_number, r.job_name].filter(Boolean).join(" · ") || r.job_name || "Job", sublabel: r.status ?? null, href: `/dashboard/jobs/${r.id}` });
    } else if (type === "workspace") {
      let query = supabase.from("workspace_documents").select("id,title").is("deleted_at", null).order("updated_at", { ascending: false }).limit(20);
      if (q) query = query.ilike("title", like);
      const { data } = await query;
      for (const r of data ?? []) results.push({ recordType: "workspace", recordId: r.id, label: r.title || "Untitled", sublabel: null, href: `/dashboard/workspace/${r.id}` });
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Record search failed.";
    const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
