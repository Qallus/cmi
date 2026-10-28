// Turn commitment and auth errors into API responses (shared by the routes).
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/require-admin";
import { CommitmentError } from "./data";

export function commitmentsError(err: unknown) {
  if (err instanceof AuthError || err instanceof CommitmentError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[commitments]", err);
  return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
}
