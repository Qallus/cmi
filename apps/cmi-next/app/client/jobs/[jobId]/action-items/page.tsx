import { redirect } from "next/navigation";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { loadClientActionItems } from "@/lib/action-items/data";
import { ActionItemsClient } from "./action-items-client";

export const dynamic = "force-dynamic";

export default async function ClientActionItemsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const items = await loadClientActionItems(contact.id, jobId);
  return <ActionItemsClient jobId={jobId} initial={items} />;
}
