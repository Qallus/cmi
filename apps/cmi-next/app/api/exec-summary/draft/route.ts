// Save (or update) an Executive Summary draft without sending it (Field Reports).
// POST { draft_id?, target, id, audience, headline, opening, facts, completed,
//        coming_soon, photos, body_html, period_start, period_end, add_back, photo_ids }
import { NextResponse } from "next/server";
import { saveDraft } from "@/lib/exec-summary/deliver";
import { parseAudience, parseTarget, summaryError, summarySession } from "@/lib/exec-summary/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await summarySession(request);
    const body = await request.json().catch(() => ({}));
    const t = parseTarget(body?.target, body?.id);
    if (!t) return NextResponse.json({ error: "Unknown record." }, { status: 400 });
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    const saved = await saveDraft({
      ...t, draft_id: typeof body?.draft_id === "string" ? body.draft_id : null,
      audience: parseAudience(body?.audience),
      headline: String(body?.headline ?? ""), opening: typeof body?.opening === "string" ? body.opening : "",
      facts: Array.isArray(body?.facts) ? body.facts : [], completed: strings(body?.completed),
      coming_soon: Array.isArray(body?.coming_soon) ? body.coming_soon : [], photos: Array.isArray(body?.photos) ? body.photos : [],
      body_html: String(body?.body_html ?? ""),
      period_start: typeof body?.period_start === "string" ? body.period_start : null,
      period_end: typeof body?.period_end === "string" ? body.period_end : null,
      add_back: strings(body?.add_back), photo_ids: strings(body?.photo_ids),
    }, actor);
    return NextResponse.json(saved);
  } catch (err) {
    return summaryError(err);
  }
}
