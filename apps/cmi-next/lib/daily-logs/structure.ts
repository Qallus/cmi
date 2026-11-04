// Field Reports, Step 2: dictation → the daily-log template. Bolt cleans up
// spoken grammar and sorts each fact into its section, using the job's trade
// partners and this week's schedule as context. It never invents quantities,
// names or results. When Bolt isn't available, a small keyword sorter files
// sentences instead and the log is flagged for a look. Server only.
import { callHermes, extractJson, hermesConfigured } from "@/lib/canvas/bolt";
import { cleanItem, SECTION_KEYS, SECTION_LABELS, type LogItem, type SectionKey } from "./sections";

export type StructureContext = { jobName: string; date: string; tradePartners: string[]; scheduleThisWeek: string[]; staff: string[] };

const SCHEMA = `Reply with ONLY JSON: {"items":[{"section":"…","text":"…", …}]}
Sections (use these keys exactly): ${SECTION_KEYS.map((k) => `${k} = ${SECTION_LABELS[k]}`).join("; ")}.
Extra fields by section, only when SAID (otherwise leave them out):
- onsite: "company", "trade", "crew" (number of people), "hours" (number)
- inspections: "result" (e.g. "Passed", "Failed: …", "Partial")
- delays: "impact" (time lost or what it holds up)
- actions: "owner" (a person's name as said), "due" (YYYY-MM-DD, only if a day was said; resolve weekdays from the log date)`;

const RULES = `You turn a superintendent's spoken notes into a clean construction daily log for Constructed Matter, Inc.
- Clean up filler ("um", "uh", "you know"), false starts and spoken grammar. Keep every fact. Short, plain sentences.
- NEVER invent quantities, names, results, times or dates that weren't said. If a result wasn't said, leave "result" out.
- One sentence can feed two sections (a delay plus the follow-up action).
- Match company names to the job's trade partners when it's clearly the same company; otherwise use the name as said.
- "internal" is for things that should never reach the client (money, sub performance, opinions).
- Look-ahead is work planned for the coming days. Visitors are people who aren't crew (inspectors count as inspections).
${SCHEMA}`;

export async function structureDictation(text: string, ctx: StructureContext): Promise<{ items: LogItem[]; sorted: boolean }> {
  const clean = text.trim();
  if (!clean) return { items: [], sorted: true };
  if (hermesConfigured()) {
    const user = `Job: ${ctx.jobName}. Log date: ${ctx.date}.
Trade partners on this job: ${ctx.tradePartners.join(", ") || "none listed"}.
CMI staff: ${ctx.staff.join(", ") || "none listed"}.
Scheduled around this week: ${ctx.scheduleThisWeek.join("; ") || "nothing listed"}.
DICTATION:
${clean.slice(0, 12_000)}`;
    const res = await callHermes([{ role: "system", content: RULES }, { role: "user", content: user }], { temperature: 0.1 });
    if (!("error" in res)) {
      const parsed = extractJson<{ items?: unknown[] }>(res.content);
      const items = (parsed?.items ?? []).map((i) => cleanItem({ ...(i as object), source: "dictated" })).filter(Boolean) as LogItem[];
      if (items.length) return { items, sorted: true };
    }
  }
  return { items: ruleSort(clean), sorted: false };
}

// Keyword sorter: the fallback (and what the prototype used offline).
const RULES_BY_SECTION: [SectionKey, RegExp][] = [
  ["safety", /\b(safety|incident|injur|ppe|hard ?hat|near miss|first aid|toolbox talk)\b/i],
  ["inspections", /\b(inspect(ion|or)|passed|failed|red ?tag|green ?tag)\b/i],
  ["delays", /\b(delay|late|held up|waiting on|rain(ed)? out|couldn'?t|no.?show|behind)\b/i],
  ["deliveries", /\b(deliver(ed|y)|dropped off|arrived|shipment)\b/i],
  ["actions", /\b(need(s)? to|follow up|call|order|remind|to do|by (monday|tuesday|wednesday|thursday|friday))\b/i],
  ["lookahead", /\b(tomorrow|next week|monday|tuesday|wednesday|thursday|friday|plan(ning)? to)\b/i],
  ["equipment", /\b(lift|excavator|bobcat|skid steer|dumpster|scaffold|generator|equipment)\b/i],
  ["visitors", /\b(visit(ed|or)|walk(ed)? (through|the site)|owner came|architect)\b/i],
];

export function ruleSort(text: string): LogItem[] {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/\b(um+|uh+|you know|like,)\s*/gi, "").trim()).filter((s) => s.length > 2);
  return sentences.map((s) => {
    const hit = RULES_BY_SECTION.find(([, re]) => re.test(s));
    const text = s.charAt(0).toUpperCase() + s.slice(1);
    return cleanItem({ section: hit ? hit[0] : "work", text, source: "dictated" })!;
  }).filter(Boolean);
}
