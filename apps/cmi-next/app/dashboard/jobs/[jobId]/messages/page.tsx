import { notFound } from "next/navigation";
import Link from "next/link";
import { getJob } from "@/lib/jobs/data";
import { DmInbox } from "@/components/direct-messages/dm-inbox";
import { JobDetailNav } from "../job-detail-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages — CMI Dashboard" };

// Job-scoped direct messages: the same DM inbox, filtered to conversations tied
// to this job (dm_conversations.job_id). New threads started here are linked to
// the job automatically.
export default async function JobMessagesPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={job.id} active="messages" />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Messages</h1>
          <span className="text-xs text-muted-foreground">Direct messages about this job</span>
        </div>
        <DmInbox jobId={job.id} className="h-[calc(100vh-16rem)]" />
      </div>
    </div>
  );
}
