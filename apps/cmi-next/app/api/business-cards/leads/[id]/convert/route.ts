// Convert a business-card lead into another dashboard record:
// contact, staff user, quote, project, or document (contract/SOW/etc.).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const ADMIN = ["super_admin", "admin"];
const OPS = ["super_admin", "admin", "project_manager", "estimator"];

type Target = "contact" | "user" | "quote" | "project" | "document";

const TARGET_ROLES: Record<Target, string[]> = {
  contact: OPS, quote: OPS, project: ["super_admin", "admin", "project_manager"],
  document: OPS, user: ADMIN,
};

function splitName(name: string | null, fallbackEmail: string | null) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || (fallbackEmail ? fallbackEmail.split("@")[0] : "Lead");
  const last = parts.slice(1).join(" ");
  return { first, last };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let staff;
  try {
    ({ staff } = await requireAdmin(request));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const body = await request.json().catch(() => null) as
    | { target?: Target; contactType?: string; role?: string; docType?: string }
    | null;
  const target = body?.target;
  if (!target || !TARGET_ROLES[target]) return NextResponse.json({ error: "Invalid target." }, { status: 400 });

  const isAdmin = ADMIN.includes(staff.role_slug);
  const sb = getSupabaseAdmin();

  // Load the lead + ownership check.
  const { data: lead } = await sb
    .from("business_card_leads")
    .select("id, owner_staff_id, name, email, phone, company, message")
    .eq("id", id).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  if (!isAdmin && lead.owner_staff_id !== staff.id) {
    return NextResponse.json({ error: "You can only convert leads for your own cards." }, { status: 403 });
  }
  if (!TARGET_ROLES[target].includes(staff.role_slug)) {
    return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create ${target}s.` }, { status: 403 });
  }

  const { first, last } = splitName(lead.name, lead.email);
  const now = new Date().toISOString();

  try {
    if (target === "contact") {
      const { data, error } = await sb.from("contacts").insert({
        first_name: first, last_name: last, email: lead.email || "", phone: lead.phone || null,
        company: lead.company || null, type: body?.contactType || "Lead", status: "active",
        source: "Business Card", notes: lead.message || null, last_activity: now,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, target, id: data.id, label: `${first} ${last}`.trim(), href: "/dashboard/contacts" });
    }

    if (target === "user") {
      const { data, error } = await sb.from("staff_users").insert({
        email: lead.email || "", first_name: first, last_name: last,
        display_name: lead.name || `${first} ${last}`.trim() || lead.email || "New user",
        phone: lead.phone || null, role_slug: body?.role || "viewer", status: "pending",
        company_name: lead.company || null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, target, id: data.id, label: lead.name || lead.email, href: "/dashboard/users" });
    }

    if (target === "quote") {
      const { data, error } = await sb.from("quotes").insert({
        name: lead.name || `${first} ${last}`.trim(), email: lead.email || null, phone: lead.phone || null,
        description: lead.message || null, status: "New", source: "Business Card",
      }).select("id").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, target, id: data.id, label: lead.name, href: "/dashboard/quotes-leads" });
    }

    if (target === "project") {
      const title = `${lead.name || lead.email || "New"} — Project`;
      const today = now.slice(0, 10);
      const { data, error } = await sb.from("project_schedule_items").insert({
        type: "project", title, project_title: title, client: lead.name || null,
        start_date: today, end_date: today, status: "pending", board_id: "default",
      }).select("id").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, target, id: data.id, label: title, href: "/dashboard/project-manager" });
    }

    if (target === "document") {
      const docType = body?.docType || "contract";
      const typeLabel = docType === "sow" ? "SOW" : docType.charAt(0).toUpperCase() + docType.slice(1);
      const { data, error } = await sb.from("documents").insert({
        id: `DOC-${Date.now()}`, type: docType, title: `${typeLabel} — ${lead.name || lead.email || "Lead"}`,
        client: lead.name || null, client_email: lead.email || null, client_phone: lead.phone || null,
        status: "draft",
      }).select("id").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, target, id: data.id, label: `${typeLabel} — ${lead.name}`, href: "/dashboard/documents" });
    }

    return NextResponse.json({ error: "Unsupported target." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Conversion failed." }, { status: 400 });
  }
}
