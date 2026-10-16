// The job top bar's Calls / SMS / Email / Notes / Prints tools: who on the job
// can be reached, and how many messages and notes the job has.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getJob } from "@/lib/jobs/data";
import { jobRecipients, loadJobCommCounts } from "@/lib/job-communications/data";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    const counts = await loadJobCommCounts(job.id);
    return NextResponse.json({ job: { id: job.id, name: job.job_name }, recipients: jobRecipients(job), counts });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
