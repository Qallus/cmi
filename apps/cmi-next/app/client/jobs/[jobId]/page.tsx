import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { getClientJob, loadClientUpdates, loadClientFiles } from "@/lib/client-portal/data";
import { loadClientActionItems } from "@/lib/action-items/data";
import { fmtDate, humanize } from "../../portal-ui";

export const dynamic = "force-dynamic";

export default async function ClientJobOverview({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const [job, updates, files, actionItems] = await Promise.all([getClientJob(contact.id, jobId), loadClientUpdates(jobId), loadClientFiles(jobId), loadClientActionItems(contact.id, jobId)]);
  if (!job) redirect("/client/jobs");
  const recentUpdates = updates.slice(0, 3);
  const recentPhotos = files.photos.slice(0, 6);
  const openActions = actionItems.filter((a) => a.status === "open" || a.status === "in_progress");
  const pm = job.project_manager_contacts[0];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {openActions.length > 0 && (
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-5">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-accent">Action Needed</h2><Link href={`/client/jobs/${jobId}/action-items`} className="text-xs text-accent hover:underline">View all</Link></div>
            <ul className="space-y-1.5">
              {openActions.slice(0, 3).map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm"><span>{a.title}</span>{a.due_date && <span className="text-xs text-muted-foreground">due {fmtDate(a.due_date)}</span>}</li>
              ))}
            </ul>
          </div>
        )}
        {job.client_description && (
          <Card title="About This Project"><p className="whitespace-pre-wrap text-sm text-muted-foreground">{job.client_description}</p></Card>
        )}

        <Card title="Recent Updates" action={<Link href={`/client/jobs/${jobId}/updates`} className="text-xs text-accent hover:underline">View all</Link>}>
          {recentUpdates.length === 0 ? <Empty>No updates yet.</Empty> : (
            <div className="space-y-3">
              {recentUpdates.map((u) => (
                <div key={u.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{u.title}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(u.created_at)}</span>
                  </div>
                  {u.body && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{u.body}</p>}
                  {u.client_action_required && <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Action needed</span>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent Photos" action={<Link href={`/client/jobs/${jobId}/photos`} className="text-xs text-accent hover:underline">View all</Link>}>
          {recentPhotos.length === 0 ? <Empty>No photos yet.</Empty> : (
            <div className="grid grid-cols-3 gap-2">
              {recentPhotos.map((p) => (
                <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md bg-muted">
                  <img src={p.file_url} alt={p.name} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Your Team">
          {pm ? (
            <div>
              <div className="text-sm font-medium">{pm.name}</div>
              <div className="text-xs text-muted-foreground">Project Manager</div>
              {pm.email && <div className="mt-2 text-xs"><a href={`mailto:${pm.email}`} className="text-accent hover:underline">{pm.email}</a></div>}
              {pm.phone && <div className="text-xs text-muted-foreground">{pm.phone}</div>}
              <Link href={`/client/jobs/${jobId}/messages`} className="mt-3 inline-flex rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90">Message your team</Link>
            </div>
          ) : <Empty>Your project manager will be assigned soon.</Empty>}
        </Card>

        <Card title="Details">
          <KV label="Job Type">{humanize(job.job_type_name)}</KV>
          {job.contract_type && <KV label="Contract">{humanize(job.contract_type)}</KV>}
          {job.square_feet != null && <KV label="Square Feet">{job.square_feet.toLocaleString()}</KV>}
          {job.permit_number && <KV label="Permit">{job.permit_number}</KV>}
          <KV label="Projected Start">{fmtDate(job.projected_start_date)}</KV>
          <KV label="Projected Completion">{fmtDate(job.projected_completion_date)}</KV>
          {job.current_phase && <KV label="Current Phase">{job.current_phase}</KV>}
          {job.next_milestone && <KV label="Next Milestone">{job.next_milestone}</KV>}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h2>{action}</div>
      {children}
    </div>
  );
}
function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-1 text-sm"><span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">{children}</div>;
}
