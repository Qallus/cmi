import { NextResponse } from "next/server";
import { loadMessages } from "@/lib/communications/data";
import { denyUnlessStaff } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const denied = await denyUnlessStaff(); if (denied) return denied;

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
