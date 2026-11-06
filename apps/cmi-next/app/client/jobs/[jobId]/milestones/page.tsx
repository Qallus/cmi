import { redirect } from "next/navigation";
import { CalendarCheck, Flag, MessageSquareWarning } from "lucide-react";
import { verifyClientJob, getJobPerms } from "@/lib/client-portal/auth";
import { clientCan } from "@/lib/client-portal/permissions";
import { loadClientMilestones } from "@/lib/client-portal/schedule";
import { standing } from "@/lib/client-portal/milestones";
import { fmtDate } from "../../../portal-ui";

export const dynamic = "force-dynamic";

const TONE = {
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  late: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  neutral: "bg-muted text-muted-foreground",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
} as const;

// The project's key dates: contract milestones and the decisions we need from
// you, each with the date in your contract, today's forecast and the gap.
export default async function ClientMilestonesPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  if (!clientCan(await getJobPerms(contact.id, jobId), "schedule_items")) redirect(`/client/jobs/${jobId}`);
  const list = await loadClientMilestones(jobId).catch(() => []);

  if (!list.length) {
    return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Your project&apos;s key dates will appear here once your schedule is shared.</div>;
  }
  const upcoming = list.filter((m) => !m.done), reached = list.filter((m) => m.done);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Key dates for your project. The forecast is our current plan; it can move with weather, inspections, deliveries and decisions.</p>
      {[["Coming up", upcoming], ["Reached", reached]].map(([label, rows]) => (rows as typeof list).length ? (
        <section key={label as string}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label as string}</h2>
          <ul className="space-y-3">
            {(rows as typeof list).map((m) => {
              const s = standing(m);
              const Icon = m.type === "client_decision" ? MessageSquareWarning : m.done ? CalendarCheck : Flag;
              return (
                <li key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <div className="font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{m.type === "client_decision" ? "Your decision" : m.type === "contract" ? "Contract milestone" : "Milestone"}</div>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TONE[s.tone]}`}>{s.label}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.done ? "Reached" : "Forecast"}</dt><dd className="font-medium">{fmtDate(m.done ? m.doneOn : m.forecast)}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Contract date</dt><dd className="font-medium">{m.contract ? fmtDate(m.contract) : "—"}</dd></div>
                    {m.note ? <div className="col-span-2 sm:col-span-1"><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Note</dt><dd>{m.note}</dd></div> : null}
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null)}
    </div>
  );
}
