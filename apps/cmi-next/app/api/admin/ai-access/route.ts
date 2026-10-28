import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { isStaffRole } from "@/lib/auth/roles";
import { AI_CAPABILITIES, getCapability, isDefaultFor, isRoleDefault } from "@/lib/ai-access/capabilities";
import { publicAppUrl } from "@/lib/twilio";

export const dynamic = "force-dynamic";

// Settings → Claude. Any staff member can view; only Super Admins change it.

type Grant = { staff_user_id: string | null; contact_id: string | null; capability: string; enabled: boolean };

function personName(r: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }) {
  return r.display_name || [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.email || "Unnamed";
}

function fail(e: unknown, fallback: string) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(fallback, e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const q = url.searchParams.get("search")?.trim();

    // Add-person search across every staff_users role and contacts.
    if (q) {
      const like = `%${q.replace(/[%_,]/g, " ")}%`;
      const [s, c] = await Promise.all([
        supabase.from("staff_users").select("id, first_name, last_name, display_name, email, role_slug, status")
          .or(`display_name.ilike.${like},email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
          .in("status", ["active", "invited"]).limit(10),
        supabase.from("contacts").select("id, first_name, last_name, email, phone, company, type")
          .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},company.ilike.${like}`).limit(10),
      ]);
      return NextResponse.json({
        results: [
          ...(s.data ?? []).map((r) => ({ subject_type: "staff", id: r.id, name: personName(r), email: r.email, kind: r.role_slug })),
          ...(c.data ?? []).map((r) => ({ subject_type: "contact", id: r.id, name: personName(r), email: r.email, kind: r.type || "Contact", company: r.company })),
        ],
      });
    }

    const { data: grantRows, error: gErr } = await supabase
      .from("ai_access_grants").select("staff_user_id, contact_id, capability, enabled").is("revoked_at", null);
    if (gErr) throw gErr;
    const grants = (grantRows ?? []) as Grant[];

    const grantedStaffIds = new Set(grants.map((g) => g.staff_user_id).filter(Boolean) as string[]);
    const grantedContactIds = [...new Set(grants.map((g) => g.contact_id).filter(Boolean) as string[])];

    const [{ data: staffRows }, { data: contactRows }, { data: tokenRows }] = await Promise.all([
      supabase.from("staff_users").select("id, first_name, last_name, display_name, email, phone, role_slug, status")
        .in("status", ["active", "invited"]).order("first_name", { ascending: true }),
      grantedContactIds.length
        ? supabase.from("contacts").select("id, first_name, last_name, email, phone, company, type").in("id", grantedContactIds)
        : Promise.resolve({ data: [] as Record<string, string | null>[] }),
      supabase.from("mcp_oauth_tokens").select("staff_user_id, last_used_at")
        .is("revoked_at", null).gt("refresh_expires_at", new Date().toISOString()),
    ]);

    const lastUsed = new Map<string, string | null>();
    for (const t of tokenRows ?? []) {
      const prev = lastUsed.get(t.staff_user_id);
      if (!prev || (t.last_used_at && t.last_used_at > prev)) lastUsed.set(t.staff_user_id, t.last_used_at ?? prev ?? null);
    }

    const explicitFor = (key: "staff_user_id" | "contact_id", id: string) =>
      Object.fromEntries(grants.filter((g) => g[key] === id).map((g) => [g.capability, g.enabled]));

    // Staff-side roles always show; clients/vendors/subs show once they hold a grant.
    const people = [
      ...(staffRows ?? [])
        .filter((r) => isStaffRole(r.role_slug) || grantedStaffIds.has(r.id))
        .map((r) => {
          const explicit = explicitFor("staff_user_id", r.id);
          const effective = Object.fromEntries(AI_CAPABILITIES.filter((c) => (c.appliesTo as readonly string[]).includes("staff"))
            .map((c) => [c.key, explicit[c.key] ?? isRoleDefault(c, r.role_slug)]));
          return {
            subject_type: "staff" as const, id: r.id, name: personName(r), email: r.email, phone: r.phone ?? null,
            kind: r.role_slug, explicit, effective,
            claude_connected: lastUsed.has(r.id), claude_last_used: lastUsed.get(r.id) ?? null,
          };
        }),
      ...((contactRows ?? []) as Record<string, string | null>[]).map((r) => {
        const explicit = explicitFor("contact_id", r.id as string);
        return {
          subject_type: "contact" as const, id: r.id as string, name: personName(r), email: r.email, phone: r.phone ?? null,
          kind: r.type || "Contact", company: r.company, explicit,
          effective: Object.fromEntries(AI_CAPABILITIES.filter((c) => (c.appliesTo as readonly string[]).includes("contact"))
            .map((c) => [c.key, explicit[c.key] ?? isDefaultFor(c, { type: "contact" })])),
          claude_connected: false, claude_last_used: null,
        };
      }),
    ];

    return NextResponse.json({
      capabilities: AI_CAPABILITIES,
      people,
      canEdit: staff.role_slug === "super_admin",
      mcpUrl: `${publicAppUrl()}/api/mcp`,
      connectedCount: lastUsed.size,
    });
  } catch (e) {
    return fail(e, "Failed to load Claude access.");
  }
}

type Body = {
  subject_type?: "staff" | "contact";
  id?: string;
  role?: string;              // bulk: every active staff_users row with this role
  capability?: string;
  enabled?: boolean | null;   // null = clear the override (back to the default)
  note?: string;
};

async function requireEditor(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.staff.role_slug !== "super_admin") throw new AuthError("Only Super Admins can change Claude access.", 403);
  return auth;
}

async function audit(actorAuthId: string, action: string, metadata: Record<string, unknown>, targetStaffId?: string) {
  const supabase = getSupabaseAdmin();
  let target: string | null = null;
  if (targetStaffId) {
    const { data } = await supabase.from("staff_users").select("auth_user_id").eq("id", targetStaffId).maybeSingle();
    target = (data?.auth_user_id as string | null) ?? null;
  }
  await supabase.from("permission_audit_logs").insert({ actor_user_id: actorAuthId, target_user_id: target, action, metadata });
}

/** Set one capability for one person (or for every person in a role). */
export async function POST(request: Request) {
  try {
    const { user, staff } = await requireEditor(request);
    const body = (await request.json()) as Body;
    const cap = body.capability ? getCapability(body.capability) : undefined;
    if (!cap) return NextResponse.json({ error: "Unknown capability." }, { status: 400 });
    if (body.enabled !== null && typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be true, false or null." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let subjects: { subject_type: "staff" | "contact"; id: string }[] = [];
    if (body.role) {
      const { data } = await supabase.from("staff_users").select("id").eq("role_slug", body.role).in("status", ["active", "invited"]);
      subjects = (data ?? []).map((r) => ({ subject_type: "staff" as const, id: r.id }));
    } else if (body.id && (body.subject_type === "staff" || body.subject_type === "contact")) {
      subjects = [{ subject_type: body.subject_type, id: body.id }];
    }
    if (!subjects.length) return NextResponse.json({ error: "Choose a person or a role." }, { status: 400 });

    const now = new Date().toISOString();
    for (const s of subjects) {
      if (!(cap.appliesTo as readonly string[]).includes(s.subject_type)) {
        return NextResponse.json({ error: `${cap.label} doesn't apply to ${s.subject_type === "contact" ? "contacts" : "staff"}.` }, { status: 400 });
      }
      const column = s.subject_type === "staff" ? "staff_user_id" : "contact_id";
      const { error: revErr } = await supabase.from("ai_access_grants")
        .update({ revoked_at: now, revoked_by: staff.id })
        .eq(column, s.id).eq("capability", cap.key).is("revoked_at", null);
      if (revErr) throw revErr;
      if (body.enabled !== null) {
        const { error: insErr } = await supabase.from("ai_access_grants").insert({
          subject_type: s.subject_type, [column]: s.id, capability: cap.key, enabled: body.enabled,
          note: body.note ?? null, granted_by: staff.id,
        });
        if (insErr) throw insErr;
      }
      await audit(user.id, body.enabled === null ? "ai_access.reset" : body.enabled ? "ai_access.grant" : "ai_access.deny",
        { subject_type: s.subject_type, subject_id: s.id, capability: cap.key, via_role: body.role ?? null },
        s.subject_type === "staff" ? s.id : undefined);
    }

    return NextResponse.json({ ok: true, updated: subjects.length });
  } catch (e) {
    return fail(e, "Failed to update Claude access.");
  }
}

/** Remove a person: revoke every capability override they hold. */
export async function DELETE(request: Request) {
  try {
    const { user, staff } = await requireEditor(request);
    const body = (await request.json()) as Body;
    if (!body.id || (body.subject_type !== "staff" && body.subject_type !== "contact")) {
      return NextResponse.json({ error: "subject_type and id are required." }, { status: 400 });
    }
    const column = body.subject_type === "staff" ? "staff_user_id" : "contact_id";
    const { error } = await getSupabaseAdmin().from("ai_access_grants")
      .update({ revoked_at: new Date().toISOString(), revoked_by: staff.id })
      .eq(column, body.id).is("revoked_at", null);
    if (error) throw error;
    await audit(user.id, "ai_access.remove", { subject_type: body.subject_type, subject_id: body.id },
      body.subject_type === "staff" ? body.id : undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e, "Failed to remove Claude access.");
  }
}
