import { NextResponse } from "next/server";
import { loadMessages } from "@/lib/communications/data";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? "100");
    const messages = await loadMessages(channel, limit);
    return NextResponse.json(messages);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
