// Field Reports, Step 3: a job's Photos library.
// GET ?from&to&source&area&trade&client_ok&tag → { photos, facets }
// PATCH { ids, patch: { area, trade, tags, caption, client_ok, starred } }
// POST { urls, source_type? } → add already-uploaded photos (e.g. from an Executive Summary)
// DELETE { ids } → remove from the library (the file stays where it was saved)
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { listPhotos, photoFacets, recordPhotos, removePhotos, updatePhotos, FIELD_REPORTS_FLAG, PHOTO_SOURCES, type PhotoSource } from "@/lib/photos/data";
import { isFeatureEnabled } from "@/lib/flags";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent", "designer"];

async function on() { return isFeatureEnabled(FIELD_REPORTS_FLAG); }
const off = () => NextResponse.json({ error: "The Photos library is switched off." }, { status: 403 });
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : []);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    if (!(await on())) return off();
    const { id } = await params;
    const q = new URL(request.url).searchParams;
    const clientOk = q.get("client_ok");
    const [photos, facets] = await Promise.all([
      listPhotos(id, { from: q.get("from"), to: q.get("to"), source: q.get("source"), area: q.get("area"), trade: q.get("trade"), tag: q.get("tag"), clientOk: clientOk === "true" ? true : clientOk === "false" ? false : null }),
      photoFacets(id),
    ]);
    return NextResponse.json({ photos, facets });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Your role can't edit photos." }, { status: 403 });
    if (!(await on())) return off();
    const { id } = await params;
    const b = (await request.json().catch(() => ({}))) as { ids?: unknown; patch?: Record<string, unknown> };
    return NextResponse.json({ photos: await updatePhotos(id, ids(b.ids), b.patch ?? {}) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Your role can't add photos." }, { status: 403 });
    if (!(await on())) return off();
    const { id } = await params;
    const b = (await request.json().catch(() => ({}))) as { urls?: unknown; source_type?: string };
    const urls = ids(b.urls).filter((u) => /^https?:\/\//.test(u));
    const source = (PHOTO_SOURCES as readonly string[]).includes(String(b.source_type)) ? (b.source_type as PhotoSource) : "upload";
    return NextResponse.json({ photos: await recordPhotos(id, urls, { source_type: source, uploaded_by: user.email ?? null, uploaded_by_id: staff.id }) }, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Your role can't remove photos." }, { status: 403 });
    if (!(await on())) return off();
    const { id } = await params;
    const b = (await request.json().catch(() => ({}))) as { ids?: unknown };
    await removePhotos(id, ids(b.ids));
    return NextResponse.json({ ok: true });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
