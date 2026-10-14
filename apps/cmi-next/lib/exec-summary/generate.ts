// Bolt writes the executive summary from a snapshot. Returns structured
// content (headline, key facts, sections) that is rendered into editable HTML.
// Server only.
import { callHermes, extractJson, hermesConfigured } from "@/lib/canvas/bolt";
import type { Audience, Snapshot } from "./snapshot";

export type SummaryFact = { label: string; value: string };
export type SummarySection = { title: string; paragraphs?: string[]; bullets?: string[] };
export type GeneratedSummary = { headline: string; facts: SummaryFact[]; sections: SummarySection[] };

const VOICE = `CMI's voice: confident, warm, plain-spoken craftsmanship. Short sentences. Specific over generic. No hype words ("exciting", "seamless", "world-class"), no emoji, no exclamation marks.`;

const TEAM_RULES = `AUDIENCE: the CMI internal team (owners, PMs, superintendents, estimators).
Be candid. Lead with what needs attention. Use real numbers and dates from the data.
Sections, in this order (omit one only if there is truly nothing for it):
1. "Snapshot" — 2–3 sentences: where the project stands right now and the one thing that matters most.
2. "Progress & Schedule" — what's done, what's in progress, what's late (name items and dates), next milestones.
3. "Budget & Financials" — contract value, approved change orders, open invoice balance or budget status/margin for Pre-Con. Flag anything off.
4. "Risks & Open Issues" — delays, overdue items, open punch items, outstanding client decisions/selections, permit or agreement gaps.
5. "Next Steps" — bullet list; each item = action + owner (if known) + date (if known).
Key facts (4–6): status/stage, % complete or probability, contract/estimated value, projected start or completion, open punch items, overdue items.`;

const CLIENT_RULES = `AUDIENCE: the homeowner/client. This will be sent to them.
Reassuring, clear, never alarming; honest about what's next. Speak as "we" (CMI) to "you".
STRICT: Never mention internal notes, internal costs, margins, markups, vendor/sub names, staff disagreements, internal risk language, or anything marked internal. Never invent commitments or dates not in the data.
For Pre-Con, use scope_notes_internal_source ONLY to describe the project scope (rooms/areas and what's being done); ignore any pricing, margin, or internal follow-up commentary in it. Mention the budget range only if it is present as estimated_budget_range.
Sections, in this order (omit any with nothing to say):
1. "Project Overview" — 2–3 sentences on the project and where it stands.
2. "Recent Progress" — what's been completed or moved forward.
3. "What's Coming Up" — upcoming milestones with dates.
4. "What We Need From You" — open client action items, pending selections or approvals (omit if none).
5. "Next Steps" — short bullet list.
Key facts (3–5): status/stage, % complete (if known), projected start or completion, contract value (Jobs only, if present).`;

export async function generateSummary(snapshot: Snapshot, audience: Audience, guidance?: string | null): Promise<GeneratedSummary> {
  if (!hermesConfigured()) throw new Error("Bolt isn't configured on this server (HERMES_AGENT_URL).");
  const system = `You are Bolt, writing a polished executive summary for Constructed Matter, Inc. (CMI), a design-build construction company in Scottsdale, Arizona.
${VOICE}
${audience === "client" ? CLIENT_RULES : TEAM_RULES}
GENERAL: Use only facts in the data. If something important is missing (no schedule, no budget), say so briefly rather than guessing. Dates as "Mar 4, 2027". Money as "$400,000". Keep the whole summary under ~350 words.
Reply with ONLY JSON:
{"headline":"one line, specific, e.g. 'Lillie Residence — design underway, construction targeted for early 2027'","facts":[{"label":"…","value":"…"}],"sections":[{"title":"…","paragraphs":["…"],"bullets":["…"]}]}`;

  const user = `${snapshot.kind}: ${snapshot.name}${snapshot.number ? ` (${snapshot.number})` : ""}
${guidance?.trim() ? `Extra direction from the person requesting it: ${guidance.trim().slice(0, 500)}\n` : ""}DATA:
${JSON.stringify(snapshot.data).slice(0, 24_000)}`;

  const res = await callHermes([{ role: "system", content: system }, { role: "user", content: user }], { temperature: 0.4 });
  if ("error" in res) throw new Error(res.error);
  const parsed = extractJson<GeneratedSummary>(res.content);
  if (!parsed?.headline || !Array.isArray(parsed.sections)) throw new Error("Bolt's summary came back in an unexpected format — try Generate again.");
  return {
    headline: String(parsed.headline).slice(0, 200),
    facts: (parsed.facts ?? []).filter((f) => f?.label && f?.value).slice(0, 6).map((f) => ({ label: String(f.label).slice(0, 40), value: String(f.value).slice(0, 80) })),
    sections: parsed.sections.filter((s) => s?.title).slice(0, 8).map((s) => ({
      title: String(s.title).slice(0, 80),
      paragraphs: (s.paragraphs ?? []).map(String).filter(Boolean).slice(0, 4),
      bullets: (s.bullets ?? []).map(String).filter(Boolean).slice(0, 12),
    })),
  };
}
