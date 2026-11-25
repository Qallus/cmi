// Draft an invitation from a typed or dictated description, via Bolt (Hermes).
// The model returns structured fields only (never HTML); everything passes
// through normalizeDesign / the event patch rules before it is saved.
import { callHermes, extractJson } from "@/lib/canvas/bolt";
import { EVENT_THEMES } from "./themes";
import type { EventDesign } from "./design";
import { draftFromModel, type EventDraft } from "./draft-parse";

export type { EventDraft };


function todayAz(): string {
  return new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);
}

const SYSTEM = `You write event invitation pages for Constructed Matter, Inc. (CMI), a design-build general contractor in Scottsdale, Arizona.
Turn the staff member's description into JSON only (no prose), with these keys:
{
  "title": "event title, e.g. Christmas Dinner & Drinks 2026",
  "start": "YYYY-MM-DDTHH:MM local Arizona time, or null if unknown",
  "end": "YYYY-MM-DDTHH:MM local Arizona time, or null",
  "location": "venue on the first line, street address on the second (use \\n), or empty",
  "rsvp_by": "YYYY-MM-DD or null",
  "allow_plus_one": true|false,
  "open_link": true if anyone with the link may RSVP (public/open house), false for a guest list,
  "summary": "one sentence for link previews",
  "design": {
    "theme": one of ${EVENT_THEMES.map((t) => `"${t.id}" (${t.description})`).join(", ")},
    "eyebrow": "short uppercase-style line, e.g. Constructed Matter · You're invited",
    "title_accent": "a word or year from the title to colour, e.g. 2026, or empty",
    "message_heading": "warm one-line heading",
    "message_body": "2-3 short sentences",
    "signoff": "e.g. Merry Christmas,\\nBrandon & Joe (only if the hosts are given)",
    "rsvp_note": "only if they mention another way to RSVP; else empty",
    "good_to_know": [{"label": "What|Getting there|Parking|Dress|Sitter|Questions|...", "value": "text", "url": "optional https link"}],
    "guest_list": "full" for staff events, "first" for client events, "count" for public events,
    "dietary": true for meals, else false,
    "footer_note": "short closing line"
  }
}
Rules: never invent facts (dates, venues, prices, phone numbers) that aren't in the description; leave them empty or null. Keep the tone warm, plain and professional. Today is ${"{TODAY}"} in Arizona.`;

export async function draftEventFromDescription(description: string, existing?: Partial<EventDesign>): Promise<EventDraft> {
  const text = description.trim().slice(0, 6000);
  if (text.length < 5) throw new Error("Describe the event in a sentence or two.");
  const reply = await callHermes(
    [
      { role: "system", content: SYSTEM.replace("{TODAY}", todayAz()) },
      { role: "user", content: text },
    ],
    { temperature: 0.4 },
  );
  if ("error" in reply) throw new Error(reply.error);
  const raw = extractJson<Record<string, unknown>>(reply.content);
  if (!raw || typeof raw !== "object") throw new Error("Bolt didn't return a usable draft. Try describing it again.");

  return draftFromModel(raw, existing);
}
