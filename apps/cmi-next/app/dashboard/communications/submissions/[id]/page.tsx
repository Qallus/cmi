import { notFound } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import {
  getContactSubmission, loadSubmissionOrder, loadSubmissionThread, type ThreadMessage,
} from "@/lib/contact-submissions/data";
import { SubmissionDetailClient } from "./submission-detail-client";

export const metadata = { title: "Contact Form Submission — CMI Dashboard" };
export const dynamic = "force-dynamic";

const CONVERT_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await getContactSubmission(id).catch(() => null);
  if (!submission) notFound();

  const staff = await getSessionStaff();

  // Both are best-effort: a missing thread or ordering degrades the page, it
  // does not break it.
  const [order, thread] = await Promise.all([
    loadSubmissionOrder().catch(() => [] as string[]),
    loadSubmissionThread(submission.email, submission.phone).catch(() => [] as ThreadMessage[]),
  ]);

  return (
    <SubmissionDetailClient
      submission={submission}
      fallbackOrder={order}
      thread={thread}
      canConvert={!!staff && CONVERT_ROLES.includes(staff.role_slug)}
    />
  );
}
