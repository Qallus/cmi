// Settings → Claude → Clients & Activity: which AI apps may connect (and at
// which risk tiers), what AI did recently, the trash with Restore, and the
// daily caps. Super Admin / Admin view and restore; Super Admin changes
// clients and caps.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadCaps, saveCaps } from "@/lib/mcp/caps";
import { RISKS, canTrash } from "@/lib/mcp/safety";
import { listTrash, restoreRecord, TrashError } from "@/lib/mcp/trash";

export const dynamic = "force-dynamic";

const KINDS = ["claude", "chatgpt", "codex", "paperclip", "other"];

function fail(e: unknown, fallback: string) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof TrashError) return NextResponse.json({ error: e.message }, { status: 400 });
  console.error(fallback, e);
  return NextResponse.json({ error: e instanceof Error ? e.message : fallback }, { status: 500 });
}

async function requireViewer(request: Request) {
  const { staff } = await requireAdmin(request);
  if (!canTrash(staff.role_slug)) throw new AuthError("Super Admin or Admin only.", 403);
  return staff;
}

export async function GET(request: Request) {
  try {
    const staff = await requireViewer(request);
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const risk = url.searchParams.get("risk");
    const person = url.searchParams.get("staff");

    let audit = supabase.from("mcp_audit_log")
      .select("id, created_at, staff_user_id, client_kind, tool, risk, entity, record_id, success, error, confirmation_id")
      .order("created_at", { ascending: false }).limit(100);
    if (risk && (RISKS as readonly string[]).includes(risk)) audit = audit.eq("risk", risk);
    if (person) audit = audit.eq("staff_user_id", person);

    const [{ data: calls }, { data: clients }, trash, caps, { data: people }] = await Promise.all([
      audit,
      supabase.from("mcp_clients").select("*").order("created_at"),
      listTrash({ limit: 100 }),
      loadCaps(),
      supabase.from("staff_users").select("id, display_name, first_name, last_name, email"),
    ]);
    const names = new Map((people ?? []).map((p) => [p.id as string,
      (p.display_name as string) || [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.email as string) || "Staff"]));

    return NextResponse.json({
      canEdit: staff.role_slug === "super_admin",
      clients: clients ?? [],
      calls: (calls ?? []).map((c) => ({ ...c, staff_name: names.get(c.staff_user_id as string) ?? "—" })),
      trash: trash.map((t) => ({ ...t, deleted_by_name: t.deleted_by ? names.get(t.deleted_by) ?? "—" : "—" })),
      caps,
      people: [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (e) {
    return fail(e, "Couldn't load AI activity.");
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requireViewer(request);
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    if (body.action === "restore") {
      return NextResponse.json({ ok: true, ...(await restoreRecord(String(body.trash_id ?? ""), staff)) });
    }

    // Everything below changes what AI apps may do: Super Admin only.
    if (staff.role_slug !== "super_admin") throw new AuthError("Only a Super Admin can change this.", 403);

    if (body.action === "caps") {
      return NextResponse.json({ ok: true, caps: await saveCaps(body.caps ?? {}, staff.id) });
    }

    if (body.action === "client") {
      const kind = String(body.kind ?? "");
      if (!KINDS.includes(kind)) return NextResponse.json({ error: "Pick a client type." }, { status: 400 });
      const name = String(body.name ?? "").trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: "Name the client." }, { status: 400 });
      const uris = (Array.isArray(body.redirect_uris) ? body.redirect_uris : String(body.redirect_uris ?? "").split(/[\s,]+/))
        .map((u: unknown) => String(u).trim()).filter(Boolean);
      for (const u of uris) {
        let parsed: URL;
        try { parsed = new URL(u); } catch { return NextResponse.json({ error: `Not a valid URL: ${u}` }, { status: 400 }); }
        if (parsed.protocol !== "https:" || parsed.hash) return NextResponse.json({ error: `Redirect URIs must be https with no #fragment: ${u}` }, { status: 400 });
      }
      const tiers = (Array.isArray(body.allowed_tiers) ? body.allowed_tiers : []).filter((t: unknown) => (RISKS as readonly string[]).includes(String(t)));
      if (!tiers.includes("read")) tiers.unshift("read");
      const row = { kind, name, redirect_uris: uris, allowed_tiers: tiers, enabled: body.enabled !== false, updated_at: new Date().toISOString() };
      const { error } = body.id
        ? await supabase.from("mcp_clients").update(row).eq("id", body.id)
        : await supabase.from("mcp_clients").insert({ ...row, created_by: staff.id });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return fail(e, "Couldn't save.");
  }
}
