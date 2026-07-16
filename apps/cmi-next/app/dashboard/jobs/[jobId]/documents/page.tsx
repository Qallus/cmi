import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardList, FileText, FolderOpen, ReceiptText } from "lucide-react";
import { getJob } from "@/lib/jobs/data";
import { loadJobDocuments, type JobDocument } from "@/lib/job-documents/data";
import { money, formatDate } from "../../job-ui";
import { JobDetailNav } from "../job-detail-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents — CMI Dashboard" };

export default async function JobDocumentsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  let docs: JobDocument[] = [];
  try { docs = await loadJobDocuments(job.job_name); } catch { docs = []; }

  const groups = new Map<string, JobDocument[]>();
  for (const d of docs) {
    const key = (d.type ?? "Other").trim() || "Other";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  const quickLinks = [
    { label: "Files", icon: FolderOpen, href: `/dashboard/jobs/${job.id}/files`, hint: "Photos, plans, uploads" },
    { label: "Invoices", icon: ReceiptText, href: `/dashboard/jobs/${job.id}/invoices`, hint: "Billing & payments" },
    { label: "Change Orders", icon: ClipboardList, href: `/dashboard/jobs/${job.id}/change-orders`, hint: "Approved changes" },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={job.id} active="documents" />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Documents</h1>
          <span className="text-xs text-muted-foreground">SOWs, quotes, and contracts for this job</span>
        </div>

        {/* Related document areas */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {quickLinks.map((q) => (
            <Link key={q.label} href={q.href} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition hover:border-accent/50">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 text-accent"><q.icon className="h-4 w-4" /></span>
              <span>
                <span className="block text-sm font-medium">{q.label}</span>
                <span className="block text-xs text-muted-foreground">{q.hint}</span>
              </span>
            </Link>
          ))}
        </div>

        {docs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No SOWs, quotes, or contracts linked to this job yet. Create them in <Link href="/dashboard/documents" className="text-accent hover:underline">Documents</Link> with this job&apos;s project name.
          </div>
        ) : (
          <div className="space-y-6">
            {[...groups.entries()].map(([type, rows]) => (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> {type} <span className="text-muted-foreground/60">({rows.length})</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  {rows.map((d, i) => (
                    <Link
                      key={d.id}
                      href="/dashboard/documents"
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-muted/40 ${i > 0 ? "border-t border-border" : ""}`}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{d.title || "Untitled document"}</span>
                      {d.status && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{d.status}</span>}
                      <span className="hidden shrink-0 text-muted-foreground sm:block">{d.value != null ? money(d.value) : ""}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{d.date ? formatDate(d.date) : ""}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
