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

    const snapshot = await buildSnapshot(t.target, t.id, audience);
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
      photos: snapshot.photos.map((p, i) => ({ ...p, include: audience === "client" ? p.clientVisible && i < 6 : i < 4 })),
      firstNames: snapshot.clientFirstNames,
      project: { name: snapshot.name, number: snapshot.number, kind: snapshot.kind },
    });
  } catch (err) {
    return summaryError(err);
  }
}
