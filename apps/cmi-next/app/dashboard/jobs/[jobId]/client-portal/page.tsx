import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadJobUpdates } from "@/lib/job-updates/data";
import { ClientPortalClient } from "./client-portal-client";

export const metadata = { title: "Client Portal — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function StaffClientPortalPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const updates = await loadJobUpdates(jobId);
  const clients = job.contacts.filter((c) => c.contact);
  return <ClientPortalClient job={job} initialUpdates={updates} clients={clients} />;
}
