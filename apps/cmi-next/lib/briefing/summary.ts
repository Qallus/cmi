// "Here's what needs you today" — the two or three sentences at the top.
//
// Written by Bolt (the Hermes gateway) from the briefing itself, and only from
// it: the prompt carries nothing but what the cards below already show, so the
// summary can't promise something the page doesn't back up. If Bolt is slow or
// down, a plain sentence built from the counts takes its place.
import { callHermes, hermesConfigured } from "@/lib/canvas/bolt";
import { briefingCounts, type Briefing } from "./build";

const TIMEOUT_MS = 20_000;

export async function briefingSummary(b: Briefing): Promise<{ text: string; fromAi: boolean }> {
  const fallback = { text: plainSummary(b), fromAi: false };
  if (!hermesConfigured()) return fallback;

  const facts = {
    date: b.dateLabel,
    meetings: b.meetings.map((m) => `${m.tag ?? ""} ${m.title}${m.detail ? ` (${m.detail})` : ""}`.trim()),
    overdue_tasks: b.tasks.overdue.map((t) => `${t.title}${t.detail ? ` — ${t.detail}` : ""} (${t.tag})`),
    due_today: b.tasks.today.map((t) => `${t.title}${t.detail ? ` — ${t.detail}` : ""}`),
    due_this_week: b.tasks.week.map((t) => `${t.title} (${t.tag})`),
    updates_overnight: b.updates.map((u) => `${u.title}: ${u.lines.join("; ")}`),
    waiting_on_you: b.attention.map((a) => `${a.title}${a.detail ? ` — ${a.detail}` : ""}`),
  };

  const result = await Promise.race([
    callHermes([
      {
        role: "system",
        content:
          "You write the opening of a construction company employee's morning briefing. " +
          "Write 2 or 3 short sentences, plain text, no greeting, no lists, no markdown. " +
          "Lead with the single most time-sensitive thing (overdue work, then today's meetings and due items), " +
          "then anything waiting on a reply. Name specific tasks, projects and times. " +
          "Use only the facts given. Never invent names, numbers, dates or advice. " +
          "If the day is light, say so in one sentence.",
      },
      { role: "user", content: `Briefing for ${b.staff.firstName}:\n${JSON.stringify(facts, null, 1)}` },
    ]),
    new Promise<{ error: string }>((resolve) => setTimeout(() => resolve({ error: "timeout" }), TIMEOUT_MS)),
  ]);

  if ("error" in result) return fallback;
  const text = result.content.replace(/[*_#`]/g, "").replace(/\s+/g, " ").trim();
  return text ? { text, fromAi: true } : fallback;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function plainSummary(b: Briefing): string {
  const c = briefingCounts(b);
  const parts: string[] = [];
  if (c.overdue) parts.push(`${plural(c.overdue, "overdue task")} to clear`);
  if (c.meetings) parts.push(`${plural(c.meetings, "meeting")} today${b.meetings[0]?.tag ? `, starting at ${b.meetings[0].tag.split("–")[0]}` : ""}`);
  if (c.dueToday) parts.push(`${plural(c.dueToday, "task")} due today`);
  if (c.attention) parts.push(`${plural(c.attention, "item")} waiting on a reply`);
  if (!parts.length) {
    return c.dueWeek
      ? `Nothing is due today. You have ${plural(c.dueWeek, "task")} coming up later this week.`
      : "A clear day: no meetings, nothing due and nothing waiting on you.";
  }
  const first = parts.join(", ").replace(/, ([^,]*)$/, " and $1");
  const overnight = c.updates === 1 ? " One of your projects had updates overnight." : c.updates ? ` ${c.updates} of your projects had updates overnight.` : "";
  return `You have ${first}.${overnight}`;
}
