import { NextRequest, NextResponse } from "next/server";
import { loadBlogPosts, createBlogPost } from "@/lib/blog/data";

export async function GET() {
  try { return NextResponse.json(await loadBlogPosts()); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try { return NextResponse.json(await createBlogPost(await req.json()), { status: 201 }); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 }); }
}
