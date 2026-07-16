import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Mail, MessageSquare, Phone } from "lucide-react";
import { getJob } from "@/lib/jobs/data";
import { loadJobCommunications, type JobComm } from "@/lib/job-communications/data";
import { JobDetailNav } from "../job-detail-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Communications — CMI Dashboard" };

function channelIcon(channel: string | null) {
  const c = (channel ?? "").toLowerCase();
  if (c === "email") return Mail;
  if (c === "sms") return MessageSquare;
  if (c === "call" || c === "voice") return Phone;
  return Mail;
}
function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function snippet(text: string | null, max = 140) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export default async function JobCommunicationsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  let comms: JobComm[] = [];
  try { comms = await loadJobCommunications(job.id); } catch { comms = []; }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={job.id} active="communications" />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Communications</h1>
          <span className="text-xs text-muted-foreground">Emails, texts, and calls with this job&apos;s contacts</span>
          <Link href="/dashboard/communications" className="ml-auto text-xs font-medium text-accent hover:underline">Open Communications →</Link>
        </div>

        {comms.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No emails, texts, or calls with this job&apos;s contacts yet.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-border">
            {comms.map((m, i) => {
              const Icon = channelIcon(m.channel);
              const inbound = (m.direction ?? "").toLowerCase() === "inbound";
              return (
                <div key={m.id} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        {inbound ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {inbound ? "In" : "Out"} · {(m.channel ?? "message").toUpperCase()}
                      </span>
                      {m.subject && <span className="truncate text-sm font-medium">{m.subject}</span>}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{fmt(m.sent_at ?? m.created_at)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{inbound ? m.from_address : m.to_address}</div>
                    {m.body && <div className="mt-1 line-clamp-2 text-sm text-foreground/90">{snippet(m.body)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
