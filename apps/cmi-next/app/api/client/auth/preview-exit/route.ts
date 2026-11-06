import { NextResponse } from "next/server";
import { PREVIEW_COOKIE, readPreview } from "@/lib/client-portal/preview";
import { cookieOptions } from "@/lib/auth/tokens";

// End a staff "Preview as client" and go back to the job's Client Portal tab.
export async function GET(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const raw = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${PREVIEW_COOKIE}=`))?.slice(PREVIEW_COOKIE.length + 1);
  const p = readPreview(raw ? decodeURIComponent(raw) : null);
  // Relative, so it stays on the address the browser used (behind the proxy request.url is internal).
  const res = new NextResponse(null, { status: 307, headers: { Location: p ? `/dashboard/jobs/${p.jobId}/client-portal` : "/dashboard" } });
  res.cookies.set(PREVIEW_COOKIE, "", cookieOptions(0));
  return res;
}
