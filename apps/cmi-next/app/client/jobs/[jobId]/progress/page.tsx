import { redirect } from "next/navigation";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { getClientJob } from "@/lib/client-portal/data";
import { loadClientScheduleItems } from "@/lib/client-portal/schedule";
import { ProgressBar, fmtDate } from "../../../portal-ui";

export const dynamic = "force-dynamic";

// A friendly phase ladder; the current phase is highlighted.
const PHASES = ["Planning", "Design", "Engineering", "Permitting", "Procurement", "Demo", "Framing", "MEP", "Inspections", "Drywall", "Finishes", "Final Walkthrough", "Completed", "Warranty"];

export default async function ClientProgressPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const job = await getClientJob(contact.id, jobId);
  if (!job) redirect("/client/jobs");
  const milestones = await loadClientScheduleItems(jobId).catch(() => []);

  const currentIdx = job.current_phase ? PHASES.findIndex((p) => p.toLowerCase() === job.current_phase!.toLowerCase()) : -1;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <ProgressBar percent={job.progress_percentage} />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Current Phase" value={job.current_phase ?? "—"} />
            <Stat label="Next Milestone" value={job.next_milestone ?? "—"} />
            <Stat label="Proj. Completion" value={fmtDate(job.projected_completion_date)} />
            <Stat label="Started" value={fmtDate(job.actual_start_date ?? job.projected_start_date)} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">Project Phases</h2>
          <ol className="space-y-1.5">
            {PHASES.map((p, i) => {
              const done = currentIdx >= 0 && i < currentIdx;
              const current = i === currentIdx;
              return (
                <li key={p} className="flex items-center gap-3 text-sm">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${done ? "bg-accent text-accent-foreground" : current ? "border-2 border-accent text-accent" : "border border-border text-muted-foreground"}`}>{done ? "✓" : i + 1}</span>
                  <span className={current ? "font-semibold text-accent" : done ? "text-foreground" : "text-muted-foreground"}>{p}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">Upcoming Milestones</h2>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled milestones yet.</p>
          ) : (
            <ul className="space-y-2">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.title}</div>
                    {m.phase && <div className="text-xs text-muted-foreground">{m.phase}</div>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    {m.start && m.end ? `${fmtDate(m.start)} – ${fmtDate(m.end)}` : fmtDate(m.end ?? m.start)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">Schedule</h2>
          <Row label="Projected Start" value={fmtDate(job.projected_start_date)} />
          <Row label="Actual Start" value={fmtDate(job.actual_start_date)} />
          <Row label="Projected Completion" value={fmtDate(job.projected_completion_date)} />
          <Row label="Actual Completion" value={fmtDate(job.actual_completion_date)} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 font-medium">{value}</div></div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-1 text-sm"><span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span><span>{value}</span></div>;
}
