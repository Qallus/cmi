import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadInvoices } from "@/lib/invoices/data";
import { InvoicesClient } from "./invoices-client";

export const metadata = { title: "Invoices — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const invoices = await loadInvoices(jobId);
  const hasClientEmail = job.contacts.some((c) => c.contact?.email);
  return <InvoicesClient jobId={jobId} jobName={job.job_name} initial={invoices} hasClientEmail={hasClientEmail} />;
}
