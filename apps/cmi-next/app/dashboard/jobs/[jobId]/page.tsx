import { redirect } from "next/navigation";

// A bare /jobs/:id lands on the job summary.
export default async function JobIndexRedirect({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  redirect(`/dashboard/jobs/${jobId}/summary`);
}
