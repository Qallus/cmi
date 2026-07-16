import { redirect } from "next/navigation";
import { verifyClientJob, getJobPerms } from "@/lib/client-portal/auth";
import { ClientJobDm } from "./client-job-dm";

export const dynamic = "force-dynamic";

export default async function ClientMessagesPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const perms = await getJobPerms(contact.id, jobId);
  if (perms.messages === false) redirect(`/client/jobs/${jobId}`);
  return <ClientJobDm jobId={jobId} />;
}
