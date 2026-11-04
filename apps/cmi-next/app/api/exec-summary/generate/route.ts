// Bolt drafts an executive summary: { target, id, audience, guidance? } →
// { headline, opening, facts, completed, coming_soon, body_html, photos,
//   firstNames, project }. Nothing is saved or sent here.
import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/exec-summary/snapshot";
import { generateSummary } from "@/lib/exec-summary/generate";
import { sectionsToHtml } from "@/lib/exec-summary/render";
import { parseAudience, parseTarget, summaryError, summarySession } from "@/lib/exec-summary/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await summarySession(request);
    const body = await request.json().catch(() => ({}));
    const t = parseTarget(body?.target, body?.id);
    if (!t) return NextResponse.json({ error: "Unknown record." }, { status: 400 });
    const audience = parseAudience(body?.audience);

    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 200) : []);
    const photoIds = strings(body?.photo_ids);
    const snapshot = await buildSnapshot(t.target, t.id, audience, {
      periodStart: typeof body?.period_start === "string" ? body.period_start : null,
      periodEnd: typeof body?.period_end === "string" ? body.period_end : null,
      addBack: strings(body?.add_back), photoIds,
    });
    if (!snapshot) return NextResponse.json({ error: "That record wasn't found." }, { status: 404 });
    const s = await generateSummary(snapshot, audience, typeof body?.guidance === "string" ? body.guidance : null);

    return NextResponse.json({
      headline: s.headline,
      opening: s.opening,
      facts: s.facts,
      completed: s.completed,
      coming_soon: s.coming_soon,
      body_html: sectionsToHtml(s),
      // Client summaries start with only client-visible photos ticked; the
      // team version starts with the four most recent.
      // Photos picked on the Photos page start ticked.
      photos: snapshot.photos.map((p, i) => ({ ...p, include: p.id && photoIds.includes(p.id) ? true : audience === "client" ? p.clientVisible && i < 6 : i < 4 })),
      period: snapshot.period ?? null,
      keptInternal: snapshot.keptInternal ?? [],
      firstNames: snapshot.clientFirstNames,
      project: { name: snapshot.name, number: snapshot.number, kind: snapshot.kind },
    });
  } catch (err) {
    return summaryError(err);
  }
}
