import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { listMessageableUsers } from "@/lib/direct-messages/data";

// Staff the current user can start a DM with.
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const url = new URL(request.url);
    const users = await listMessageableUsers(staff.id, url.searchParams.get("search") ?? undefined);
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ users: [] }, { status: error.status });
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
