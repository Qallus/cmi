// Live call history + stats, read straight from the Twilio REST API.
import { NextResponse } from "next/server";
import twilio from "twilio";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getOwnedNumbers } from "@/lib/twilio";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "Twilio credentials not configured." }, { status: 501 });
  }

  const url = new URL(request.url);
  const voicemailOnly = url.searchParams.get("voicemail") === "true";
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);

  const client = twilio(accountSid, authToken);
  const ownedNumbers = getOwnedNumbers();

  // Pull recent inbound (to our numbers) and outbound (from our numbers) calls.
  const lists = await Promise.all([
    ...ownedNumbers.map((num) => client.calls.list({ to: num, limit })),
    ...ownedNumbers.map((num) => client.calls.list({ from: num, limit })),
  ]);

  // De-dupe by SID (a call can match both queries) and sort newest first.
  const bySid = new Map<string, (typeof lists)[number][number]>();
  for (const batch of lists) for (const call of batch) bySid.set(call.sid, call);

  const allCalls = Array.from(bySid.values()).sort(
    (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
  );

  const calls = allCalls.slice(0, limit).map((call) => ({
    sid: call.sid,
    to: call.to,
    from: call.from,
    status: call.status,
    direction: call.direction,
    duration: call.duration,
    price: call.price,
    priceUnit: call.priceUnit,
    dateCreated: call.dateCreated,
    startTime: call.startTime,
    endTime: call.endTime,
  }));

  // ── Stats (today, across the full fetched window) ──────────────────────────
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let outboundToday = 0;
  let inboundToday = 0;
  let totalTalkSeconds = 0;
  let completedCount = 0;
  let totalCost = 0;

  for (const call of allCalls) {
    const isOutbound = (call.direction || "").startsWith("outbound");
    const created = call.dateCreated ? new Date(call.dateCreated) : null;
    if (created && created >= startOfToday) {
      if (isOutbound) outboundToday += 1;
      else inboundToday += 1;
    }
    const dur = Number(call.duration || 0);
    if (call.status === "completed" && dur > 0) {
      totalTalkSeconds += dur;
      completedCount += 1;
    }
    if (call.price) totalCost += Math.abs(Number(call.price));
  }

  const stats = {
    outboundToday,
    inboundToday,
    totalCalls: allCalls.length,
    avgTalkSeconds: completedCount ? Math.round(totalTalkSeconds / completedCount) : 0,
    totalCost: Number(totalCost.toFixed(4)),
  };

  if (voicemailOnly) {
    const inbound = calls.filter(
      (c) =>
        c.direction === "inbound" && (c.status === "no-answer" || c.status === "completed"),
    );
    return NextResponse.json({ calls: inbound, stats });
  }

  return NextResponse.json({ calls, stats });
}
