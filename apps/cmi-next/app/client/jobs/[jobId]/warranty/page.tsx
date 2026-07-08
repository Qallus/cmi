import { redirect } from "next/navigation";
import { verifyClientJob, getJobPerms } from "@/lib/client-portal/auth";
import { getClientJob, loadClientWarranty } from "@/lib/client-portal/data";
import { ClientWarranty } from "./warranty-client";

export const dynamic = "force-dynamic";

export default async function ClientWarrantyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const [job, perms, requests] = await Promise.all([getClientJob(contact.id, jobId), getJobPerms(contact.id, jobId), loadClientWarranty(jobId, contact.id)]);
  if (!job) redirect("/client/jobs");
  // Clients can submit when the job is in warranty (or staff explicitly allowed it).
  const canSubmit = job.status === "warranty" || !!perms.warranty_claims;
  return <ClientWarranty jobId={jobId} initial={requests as never} canSubmit={canSubmit} />;
}
