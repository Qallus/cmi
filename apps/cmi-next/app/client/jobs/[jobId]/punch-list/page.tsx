import { redirect } from "next/navigation";
import { Check, ClipboardCheck } from "lucide-react";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { loadLists } from "@/lib/punch/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Client view of the punch lists staff chose to share on this job. Read-only:
// the client sees each item and whether it's done — not internal notes or
// who it's assigned to. Staff check items off in the dashboard.
export default async function ClientPunchListPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const lists = await loadLists({ parentType: "job", parentId: jobId, clientVisibleOnly: true });

  if (!lists.length) {
    return <p className="text-sm text-muted-foreground">There are no punch lists to show yet.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">The items our team is finishing up on your project. Checked items are complete.</p>
      {lists.map((l) => {
        const done = l.items.filter((i) => i.completed_at).length;
        const pct = l.items.length ? Math.round((done / l.items.length) * 100) : 0;
        return (
          <section key={l.id} className="rounded-xl border border-border bg-card">
            <div className="p-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ClipboardCheck className="h-5 w-5 text-accent" /> {l.title}</h2>
              {l.description && <div className="prose prose-sm mt-1 max-w-none text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: l.description }} />}
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-accent")} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{done} of {l.items.length} complete</span>
              </div>
            </div>
            <ul className="divide-y divide-border border-t border-border">
              {l.items.map((i) => {
                const isDone = !!i.completed_at;
                return (
                  <li key={i.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2",
                      isDone ? "border-success bg-success text-white" : "border-border")}>
                      {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0">
                      <div className={cn("text-sm", isDone && "text-muted-foreground line-through")}>{i.title}</div>
                      {i.location && <div className="text-xs text-muted-foreground">{i.location}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
