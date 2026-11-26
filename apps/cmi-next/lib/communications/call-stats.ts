// Call stats for the dashboard, from Twilio: every call to or from CMI's
// numbers since the start of last month. It's one shared office line, so the
// numbers are company-wide. Cached for a minute so a page of stat cards makes
// one round of Twilio calls. Returns null when Twilio isn't configured.
import twilio from "twilio";
import { getOwnedNumbers } from "@/lib/twilio";
import { summarizeCalls, type CallSummary } from "./call-stats-core";

let cache: { at: number; value: CallSummary | null } | null = null;
const TTL = 60_000;

export async function loadCallStats(): Promise<CallSummary | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const numbers = getOwnedNumbers();
  if (!sid || !token || !numbers.length) return null;
  try {
    const client = twilio(sid, token);
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCMonth(since.getUTCMonth() - 1);
    since.setUTCHours(0, 0, 0, 0);
    const lists = await Promise.all([
      ...numbers.map((num) => client.calls.list({ to: num, startTimeAfter: since, limit: 1000 })),
      ...numbers.map((num) => client.calls.list({ from: num, startTimeAfter: since, limit: 1000 })),
    ]);
    const bySid = new Map<string, { direction: string; status: string; dateCreated: Date }>();
    for (const batch of lists) for (const call of batch) bySid.set(call.sid, { direction: call.direction, status: call.status, dateCreated: call.dateCreated });
    const value = summarizeCalls([...bySid.values()]);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}
