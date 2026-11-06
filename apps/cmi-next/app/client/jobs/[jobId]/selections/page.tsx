import { redirect } from "next/navigation";
import { verifyClientJob, getJobPerms } from "@/lib/client-portal/auth";
import { loadClientJobSelections } from "@/lib/job-selections/data";
import { SelectionsClient } from "./selections-client";
import { clientCan } from "@/lib/client-portal/permissions";

export const dynamic = "force-dynamic";

export default async function ClientSelectionsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const perms = await getJobPerms(contact.id, jobId);
  if (!clientCan(perms, "locked_selections")) redirect(`/client/jobs/${jobId}`);
  const selections = await loadClientJobSelections(jobId);
  return <SelectionsClient jobId={jobId} initial={selections} />;
}
