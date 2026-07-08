import { redirect } from "next/navigation";
import { verifyClientJob, getJobPerms } from "@/lib/client-portal/auth";
import { loadClientMessages } from "@/lib/client-portal/data";
import { ClientMessages } from "./messages-client";

export const dynamic = "force-dynamic";

export default async function ClientMessagesPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const perms = await getJobPerms(contact.id, jobId);
  if (perms.messages === false) redirect(`/client/jobs/${jobId}`);
  const messages = await loadClientMessages(jobId);
  return <ClientMessages jobId={jobId} initial={messages as never} />;
}
