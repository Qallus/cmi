import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseTakeOff, TAKE_OFF_FLAG } from "@/lib/take-off/access";
import TakeOffModule from "@/components/take-off/take-off-module";

export const metadata = { title: "Take-Off — CMI Dashboard" };
export const dynamic = "force-dynamic";

/** Additive route. Inherits the current dashboard layout; no layout.tsx is added. */
export default async function TakeOffPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseTakeOff(staff.role_slug)) notFound();
  if (!(await isFeatureEnabled(TAKE_OFF_FLAG))) notFound();
  return <TakeOffModule />;
}
