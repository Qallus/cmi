// Send a reviewed executive summary by email or text (and, for a client summary on a
// Job, optionally post it to the client portal). Saves it to the history.
import { NextResponse } from "next/server";
import { sendSummary } from "@/lib/exec-summary/deliver";
import { parseAudience, parseTarget, summaryError, summarySession } from "@/lib/exec-summary/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await summarySession(request);
    const body = await request.json().catch(() => ({}));
    const t = parseTarget(body?.target, body?.id);
    if (!t) return NextResponse.json({ error: "Unknown record." }, { status: 400 });
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    const result = await sendSummary({
      ...t,
      audience: parseAudience(body?.audience),
      headline: String(body?.headline ?? ""),
      opening: typeof body?.opening === "string" ? body.opening : "",
      facts: Array.isArray(body?.facts) ? body.facts : [],
      completed: strings(body?.completed),
      coming_soon: Array.isArray(body?.coming_soon) ? body.coming_soon : [],
      photos: Array.isArray(body?.photos) ? body.photos : [],
      body_html: String(body?.body_html ?? ""),
      note: typeof body?.note === "string" ? body.note.slice(0, 1000) : null,
      staff_ids: strings(body?.staff_ids),
      contact_ids: strings(body?.contact_ids),
      channel: body?.channel === "sms" ? "sms" : "email",
      extra_emails: strings(body?.extra_emails).slice(0, 10),
      extra_phones: strings(body?.extra_phones).slice(0, 10),
      post_to_portal: !!body?.post_to_portal,
    }, actor);
    return NextResponse.json(result);
  } catch (err) {
    return summaryError(err);
  }
}
