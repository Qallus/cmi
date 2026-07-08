// Mints a SHORT-LIVED ephemeral token for the xAI Voice Agent so the browser can
// connect directly to the realtime API without ever seeing XAI_API_KEY.
// Docs: https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const key = process.env.XAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Voice agent is not configured." }, { status: 503 });

  try {
    const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Token request failed (${res.status}).` }, { status: 502 });
    }
    const json = await res.json() as Record<string, unknown>;

    // The token field name can vary; accept the common shapes defensively.
    const cs = json.client_secret as { value?: string } | string | undefined;
    const token = (typeof cs === "object" ? cs?.value : cs)
      ?? (json.value as string | undefined)
      ?? (json.token as string | undefined)
      ?? (json.ephemeral_key as string | undefined);
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Malformed token response." }, { status: 502 });
    }

    return NextResponse.json({
      token,
      agent_id: process.env.XAI_VOICE_AGENT_ID || "agent_xmHtZr95yUMAPDUG",
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the voice service." }, { status: 502 });
  }
}
