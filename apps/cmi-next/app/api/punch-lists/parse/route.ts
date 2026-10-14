// Turn dictated or imported text into punch items: { text } → { items, by }.
// Bolt tidies the wording and pulls out room / trade / priority when it's
// configured; otherwise (or if it fails) the plain line/sentence splitter runs.
// Nothing is saved — the UI previews the items first.
import { NextResponse } from "next/server";
import { callHermes, extractJson, hermesConfigured } from "@/lib/canvas/bolt";
import { parsePunchText } from "@/lib/punch/parse";
import { punchError, punchSession } from "@/lib/punch/api";
import { PUNCH_PRIORITIES, type PunchItemDraft, type PunchPriority } from "@/lib/punch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_CHARS = 20_000;

const PROMPT = `You turn a construction site walk (dictated or typed) into punch list items for Constructed Matter, Inc.
Each item is one fix or task, written as a short imperative ("Touch up paint at hallway corner").
Return ONLY JSON: {"items":[{"title":"…","location":"room/area or null","trade":"Paint|Electrical|Plumbing|Carpentry|Tile|Flooring|HVAC|Cabinets|Exterior|Landscape|Cleaning|General or null","priority":"low|normal|high|urgent"}]}
Rules: use only what is said; never invent items; keep the speaker's specifics (sizes, colors, which wall); merge fragments that belong to one item; default priority "normal", "high"/"urgent" only when the text says so (safety, leaks, client-facing deadline).`;

export async function POST(request: Request) {
  try {
    await punchSession(request, true);
    const body = (await request.json().catch(() => ({}))) as { text?: string };
    const text = (body.text ?? "").slice(0, MAX_CHARS).trim();
    if (!text) return NextResponse.json({ error: "Nothing to read." }, { status: 400 });

    if (hermesConfigured()) {
      const res = await callHermes([{ role: "system", content: PROMPT }, { role: "user", content: text }], { temperature: 0.1 });
      if (!("error" in res)) {
        const parsed = extractJson<{ items?: PunchItemDraft[] }>(res.content);
        const items = (parsed?.items ?? [])
          .filter((i) => typeof i?.title === "string" && i.title.trim())
          .map((i) => ({
            title: i.title.trim().slice(0, 300),
            location: typeof i.location === "string" && i.location.trim() && i.location !== "null" ? i.location.trim() : null,
            trade: typeof i.trade === "string" && i.trade.trim() && i.trade !== "null" ? i.trade.trim() : null,
            priority: PUNCH_PRIORITIES.includes(i.priority as PunchPriority) ? i.priority : "normal",
          }));
        if (items.length) return NextResponse.json({ items, by: "bolt" });
      }
    }
    return NextResponse.json({ items: parsePunchText(text), by: "lines" });
  } catch (err) {
    return punchError(err);
  }
}
