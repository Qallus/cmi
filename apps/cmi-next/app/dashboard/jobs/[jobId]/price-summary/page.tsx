import { notFound } from "next/navigation";
import { buildPriceSummary, getJob } from "@/lib/jobs/data";
import { PriceSummaryClient } from "./price-summary-client";

export const metadata = { title: "Job Price Summary — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function PriceSummaryPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const summary = await buildPriceSummary(jobId);
  const primary = job.contacts.find((c) => c.is_primary) ?? job.contacts[0];
  const client = primary?.contact
    ? { name: `${primary.contact.first_name} ${primary.contact.last_name}`.trim(), email: primary.contact.email, phone: primary.contact.phone }
    : null;
  return <PriceSummaryClient summary={summary} client={client} />;
}
