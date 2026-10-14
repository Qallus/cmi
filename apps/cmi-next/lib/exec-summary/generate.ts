// Bolt writes the executive summary from a snapshot: a personal opening
// paragraph, key facts, Completed / Coming Soon lists, and the remaining
// sections. Rendered into the branded document by render.ts. Server only.
import { callHermes, extractJson, hermesConfigured } from "@/lib/canvas/bolt";
import type { Audience, Snapshot } from "./snapshot";

export type SummaryFact = { label: string; value: string };
export type SummarySection = { title: string; paragraphs?: string[]; bullets?: string[] };
export type ComingSoon = { item: string; when: string | null };
export type GeneratedSummary = {
  headline: string;
  /** Starts "Hi {{first_name}}," — the token is filled per recipient. */
  opening: string;
  facts: SummaryFact[];
  completed: string[];
  coming_soon: ComingSoon[];
  sections: SummarySection[];
};

const VOICE = `CMI's voice: confident, warm, plain-spoken craftsmanship. Short sentences. Specific over generic. No hype words ("exciting", "seamless", "world-class"), no emoji, no exclamation marks.`;

const OPENING = `OPENING PARAGRAPH ("opening") — the most important part. Write it like a project manager's personal weekly note, flowing like this example:
"Hi {{first_name}},
Your project is moving along well. This week we finished the framing inspection. Our team has started on the rough plumbing. Next week our electrical partners will be pulling wire for the kitchen and great room. The Anthea tile will arrive on Oct 28, and your project manager Ben Peck will be there to check it in."
Rules: begin exactly with "Hi {{first_name}}," on its own line (keep the token literally — it is replaced per recipient). Then 3–5 sentences in that order: overall status → what we finished → what we started / are working on now → what's next (name the trade partner type when the item implies one: electrical, plumbing, HVAC, framing, drywall, tile, cabinets, paint, landscape) → any selection arriving and who will be there (use project.project_manager). Use ONLY facts from progress, selections_arriving_soon, daily_logs_recent_positive and punch list completions. If a fact is missing, leave that sentence out — never invent dates, trades or names.`;

const POSITIVE = `NEVER mention problems found on site, damage, defects, repairs, or negative daily-log or punch-list items anywhere (the data has been pre-filtered; do not infer problems either).`;

const TEAM_RULES = `AUDIENCE: the CMI internal team. Opening starts "Hi {{first_name}}," the same way, candid but upbeat.
completed: up to 8 short items done (from progress.completed, punch list recently_completed, selections_recently_installed).
coming_soon: up to 6 {item, when} for the next few weeks (progress.in_progress first, then progress.coming_soon; "when" like "This week", "Oct 22" or "Oct 22 – Nov 10"; selections arriving too).
sections, in order (omit if empty):
1. "Budget & Financials" — contract value, approved change orders, open invoice balance (Pre-Con: budget status, estimate, probability).
2. "Watch List" — schedule items running late, decisions/selections still pending, permits or agreements outstanding. ${POSITIVE}
3. "Next Steps" — bullets: action + owner (if known) + date (if known).
Key facts (4–6): status/stage, % complete, contract or estimated value, projected completion/start, current phase.
Mention if progress.basis is not "item statuses" in Watch List as: "Schedule statuses aren't being updated — progress is based on <basis>." If progress.schedule_dates_outdated is true, add: "Schedule dates are behind the current phase — update the schedule."`;

const CLIENT_RULES = `AUDIENCE: the homeowner/client. This is sent to them. Reassuring, clear, honest. "We" (CMI) to "you".
STRICT: never mention internal notes, costs other than the contract value, margins, markups, vendor/sub company names, staff, internal risk language. ${POSITIVE}
For Pre-Con, use scope_notes_internal_source ONLY to describe scope (rooms/areas and what's being done); ignore pricing, margins and internal follow-up commentary in it.
completed: up to 8 short, client-friendly items finished.
coming_soon: up to 6 {item, when}.
sections, in order (omit if empty):
1. "What We Need From You" — open client action items and selections_awaiting_client_decision, phrased as friendly requests.
2. "Next Steps" — 2–4 short bullets.
Key facts (3–5): status/stage, % complete, current phase, projected completion (or projected construction start for Pre-Con).`;

export async function generateSummary(snapshot: Snapshot, audience: Audience, guidance?: string | null): Promise<GeneratedSummary> {
  if (!hermesConfigured()) throw new Error("Bolt isn't configured on this server (HERMES_AGENT_URL).");
  const system = `You are Bolt, writing a polished executive summary for Constructed Matter, Inc. (CMI), a design-build construction company in Scottsdale, Arizona.
${VOICE}
${OPENING}
${audience === "client" ? CLIENT_RULES : TEAM_RULES}
GENERAL: Use only facts in the data. Never put a date in the past on a coming_soon item; if an item has no date, set "when" to null. Dates as "Oct 22" (add the year only if not this year). Money as "$465,000". Under ~350 words total.
Reply with ONLY JSON:
{"headline":"one specific line, e.g. 'The Waters Residence — framing underway, on track for November'","opening":"Hi {{first_name}},\\n…","facts":[{"label":"…","value":"…"}],"completed":["…"],"coming_soon":[{"item":"…","when":"…"}],"sections":[{"title":"…","paragraphs":["…"],"bullets":["…"]}]}`;

  const user = `${snapshot.kind}: ${snapshot.name}${snapshot.number ? ` (${snapshot.number})` : ""}
${guidance?.trim() ? `Extra direction from the person requesting it: ${guidance.trim().slice(0, 500)}\n` : ""}DATA:
${JSON.stringify(snapshot.data).slice(0, 24_000)}`;

  const res = await callHermes([{ role: "system", content: system }, { role: "user", content: user }], { temperature: 0.4 });
  if ("error" in res) throw new Error(res.error);
  const p = extractJson<GeneratedSummary>(res.content);
  if (!p?.headline) throw new Error("Bolt's summary came back in an unexpected format — try Generate again.");
  return normalize(p);
}

export function normalize(p: Partial<GeneratedSummary>): GeneratedSummary {
  let opening = String(p.opening ?? "").trim();
  if (opening && !/^hi\b/i.test(opening)) opening = `Hi {{first_name}},\n${opening}`;
  opening = opening.replace(/\{\{\{?\s*first_name\s*\}?\}\}/gi, "{{first_name}}");
  return {
    headline: String(p.headline ?? "").slice(0, 200),
    opening: opening.slice(0, 1500),
    facts: (p.facts ?? []).filter((f) => f?.label && f?.value).slice(0, 6).map((f) => ({ label: String(f.label).slice(0, 40), value: String(f.value).slice(0, 80) })),
    completed: (p.completed ?? []).map(String).filter(Boolean).slice(0, 10),
    coming_soon: (p.coming_soon ?? []).filter((c) => c?.item).slice(0, 8).map((c) => ({ item: String(c.item).slice(0, 160), when: c.when ? String(c.when).slice(0, 40) : null })),
    sections: (p.sections ?? []).filter((s) => s?.title).slice(0, 6).map((s) => ({
      title: String(s.title).slice(0, 80),
      paragraphs: (s.paragraphs ?? []).map(String).filter(Boolean).slice(0, 4),
      bullets: (s.bullets ?? []).map(String).filter(Boolean).slice(0, 12),
    })),
  };
}
