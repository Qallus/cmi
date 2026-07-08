import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-portal/auth";
import { loadClientJobs } from "@/lib/client-portal/data";
import { ClientStatusBadge, ProgressBar, fmtDate } from "../portal-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Projects — Constructed Matter" };

export default async function ClientJobsPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const jobs = await loadClientJobs(session.contact.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">My Projects</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back{session.contact.first_name ? `, ${session.contact.first_name}` : ""}.</p>

      {jobs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No projects are available yet. Your Constructed Matter team will enable your project portal soon.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {jobs.map((j) => (
            <Link key={j.id} href={`/client/jobs/${j.id}`} className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-accent/50">
              <div className="h-32 bg-muted">
                {j.cover_image_url ? <img src={j.cover_image_url} alt={j.job_name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No cover photo</div>}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] text-muted-foreground">{j.job_number ?? ""}</div>
                  <ClientStatusBadge status={j.status} />
                </div>
                <div className="mt-1 font-medium">{j.job_name}</div>
                <div className="text-xs text-muted-foreground">{[j.job_type_name, j.full_address].filter(Boolean).join(" · ")}</div>
                {j.project_managers.length > 0 && <div className="mt-1 text-xs text-muted-foreground">PM: {j.project_managers.join(", ")}</div>}
                <div className="mt-3"><ProgressBar percent={j.progress_percentage} /></div>
                {j.current_phase && <div className="mt-2 text-xs text-muted-foreground">Phase: <span className="text-foreground">{j.current_phase}</span></div>}
                <div className="mt-1 text-[11px] text-muted-foreground">Last update: {fmtDate(j.last_client_update_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
