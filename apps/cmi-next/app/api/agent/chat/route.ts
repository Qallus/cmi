import { NextRequest, NextResponse } from "next/server";

const hermesUrl = process.env.HERMES_AGENT_URL;
const hermesKey = process.env.HERMES_AGENT_API_KEY;
const hermesModel = process.env.HERMES_AGENT_MODEL ?? "hermes-agent";

export async function POST(req: NextRequest) {
  if (!hermesUrl) {
    return NextResponse.json(
      { error: "HERMES_AGENT_URL is not configured. Add it to .env.local." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { messages, stream = false } = body as {
    messages: Array<{ role: string; content: string }>;
    stream?: boolean;
  };

  if (!Array.isArray(messages) || !messages.length) {
    return NextResponse.json({ error: "messages array is required." }, { status: 400 });
  }

  const upstream = `${hermesUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (hermesKey) headers["Authorization"] = `Bearer ${hermesKey}`;

  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: hermesModel, messages, stream }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: `Hermes gateway returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    if (stream) {
      return new NextResponse(res.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not reach Hermes gateway: ${message}` },
      { status: 502 }
    );
  }
}
