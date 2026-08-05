import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { listVendors, createVendor } from "@/lib/vendors/data";

export async function GET() {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json({ vendors: await listVendors() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load vendors." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = (await req.json()) as { name?: string; website_url?: string; logo_url?: string; category?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "Vendor name is required." }, { status: 400 });
    const vendor = await createVendor({ name, website_url: body.website_url, logo_url: body.logo_url, category: body.category });
    return NextResponse.json({ vendor });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add vendor." }, { status: 400 });
  }
}
