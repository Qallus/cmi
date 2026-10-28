import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { listCommitments } from "@/lib/commitments/data";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { CommitmentsClient } from "./commitments-client";

export const metadata = { title: "Commitments — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Promises and follow-ups across CMI, kept until done (with evidence). Claude
// and Bolt add them from emails and meetings; staff add and close them here.
// Behind the `commitments` flag.
export default async function CommitmentsPage() {
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!(await isFeatureEnabled("commitments"))) notFound();
  const [initial, people] = await Promise.all([
    listCommitments({ ownerId: staff.id, status: "open", limit: 300 }),
    loadAssignableStaff(),
  ]);
  return (
    <CommitmentsClient
      initial={initial}
      meId={staff.id}
      canSeeAll={["super_admin", "admin"].includes(staff.role_slug)}
      people={people.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
