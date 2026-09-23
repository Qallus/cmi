// Live "this person may already exist" lookup, called as staff type a name.
import { NextResponse } from "next/server";
import { denyUnlessStaff } from "@/lib/auth/guard";
import { findDuplicateContacts } from "@/lib/contacts/duplicates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try {
    const q = new URL(request.url).searchParams;
    const matches = await findDuplicateContacts({
      first: q.get("first"),
      last: q.get("last"),
      email: q.get("email"),
      phone: q.get("phone"),
      company: q.get("company"),
      excludeId: q.get("exclude"),
      limit: 5,
    });
    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lookup failed." }, { status: 500 });
  }
}
