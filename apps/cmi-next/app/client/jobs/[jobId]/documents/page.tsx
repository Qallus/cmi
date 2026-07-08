import { redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { loadClientFiles } from "@/lib/client-portal/data";
import { fmtDate } from "../../../portal-ui";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const { documents } = await loadClientFiles(jobId);

  if (documents.length === 0) return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No documents have been shared yet.</div>;
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {documents.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{d.name}</div>
              <div className="text-xs text-muted-foreground">{d.folder} · {fmtDate(d.created_at)}</div>
            </div>
          </div>
          <a href={d.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /> Download</a>
        </div>
      ))}
    </div>
  );
}
