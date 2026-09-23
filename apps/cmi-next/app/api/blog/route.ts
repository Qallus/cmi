import { NextRequest, NextResponse } from "next/server";
import { loadBlogPosts, createBlogPost } from "@/lib/blog/data";
import { denyUnlessStaff } from "@/lib/auth/guard";

export async function GET() {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try { return NextResponse.json(await loadBlogPosts()); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try { return NextResponse.json(await createBlogPost(await req.json()), { status: 201 }); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 }); }
}
