import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { hrefForLink, LINK_TYPES } from "@/lib/schedules/links";
import type { LinkType } from "@/lib/schedules/types";

// GET ?type=…&id=… — opens the record a schedule item points at.
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") as LinkType | null;
    const id = url.searchParams.get("id");
    if (!type || !id || !LINK_TYPES.includes(type)) return NextResponse.json({ error: "Unknown record." }, { status: 400 });
    return NextResponse.redirect(new URL(await hrefForLink(type, id), url.origin));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
