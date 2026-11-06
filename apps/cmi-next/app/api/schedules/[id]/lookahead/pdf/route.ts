// Three-week lookahead PDF (Phase 2 Step 3), internal or client version.
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { PROGRESS_FLAG } from "@/lib/schedules/engine";
import { loadLookahead } from "@/lib/schedules/lookahead-data";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { LookaheadPdf } from "@/components/pdf/lookahead-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await isFeatureEnabled(PROGRESS_FLAG))) return NextResponse.json({ error: "Progress tracking is switched off." }, { status: 403 });
    const { id } = await params;
    const audience = new URL(request.url).searchParams.get("audience") === "client" ? "client" : "internal";
    const [data, logo] = await Promise.all([loadLookahead(id, audience), getBrandLogoDataUri()]);
    const buffer = await renderPdf(createElement(LookaheadPdf, { data, logo }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${data.schedule.name.replace(/[^a-z0-9._-]+/gi, "_")}-lookahead${audience === "client" ? "-client" : ""}.pdf"`,
      },
    });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
