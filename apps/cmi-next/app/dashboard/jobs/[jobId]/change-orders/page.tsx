import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadChangeOrders } from "@/lib/change-orders/data";
import { ChangeOrdersClient } from "./change-orders-client";

export const metadata = { title: "Change Orders — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function ChangeOrdersPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const changeOrders = await loadChangeOrders(jobId);
  return <ChangeOrdersClient jobId={jobId} jobName={job.job_name} initial={changeOrders} />;
}
