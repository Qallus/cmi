// Weather for a daily log: GET /api/weather?kind=job|opportunity&id=<id>&date=YYYY-MM-DD
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { weatherForSite } from "@/lib/weather";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") === "opportunity" ? "opportunity" : "job";
    const id = url.searchParams.get("id");
    const date = url.searchParams.get("date") || new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "id and date are required." }, { status: 400 });
    return NextResponse.json({ weather: await weatherForSite(kind, id, date) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ weather: null });
  }
}
