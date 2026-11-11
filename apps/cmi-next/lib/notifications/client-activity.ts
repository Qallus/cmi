// One way to tell the team a CLIENT did something on a job: a selection
// comment or decision, a message, a warranty request, a finished action item,
// a Project Canvas brief. Bell + push + email to clientAlertRecipients (team,
// the PM even if muted, else admins). Email and push are held outside
// production by notifyStaff. Never throws; logs when it reaches nobody or fails.
import { notifyStaff } from "./dispatch";

export type ClientActivity = {
  jobId: string;
  kind: string;
  /** "Jane Lindquist commented on Vanity Faucet" */
  title: string;
  /** What they wrote, if anything. */
  note?: string | null;
  url: string;
  sourceTable: string;
  sourceId?: string | null;
  /** Email eyebrow, e.g. "Selection comment". */
  label: string;
  facts?: { label: string; value: string }[];
  ctaLabel?: string;
};

export async function notifyClientActivity(a: ClientActivity): Promise<void> {
  try {
    const { clientAlertRecipients } = await import("@/lib/jobs/data");
    const plan = await clientAlertRecipients(a.jobId);
    if (!plan.ids.length) {
      console.error(`[client-activity] nobody to tell about ${a.kind} on job ${a.jobId}`);
      return;
    }
    if (plan.fallback) console.warn(`[client-activity] job ${a.jobId} has no team or PM; telling admins about ${a.kind}`);
    const job = await jobLabel(a.jobId);
    const note = a.note?.trim() || null;
    const r = await notifyStaff({
      recipientIds: plan.ids, actorId: null,
      kind: a.kind, title: a.title, body: note ? clip(note, 240) : job,
      url: a.url, sourceTable: a.sourceTable, sourceId: a.sourceId ?? null, dedupeKey: null,
      email: {
        subject: job ? `${a.title} · ${job}` : a.title,
        ctaLabel: a.ctaLabel ?? "Open and reply",
        content: {
          eyebrow: a.label,
          heading: a.title,
          quote: note,
          facts: [...(job ? [{ label: "Job", value: job }] : []), ...(a.facts ?? [])],
          closing: "The client is waiting on the team. Reply from the job in the dashboard.",
        },
      },
    });
    const real = r.errors.filter((e) => e !== "outbound held: not production");
    if (real.length) console.error(`[client-activity] ${a.kind} on job ${a.jobId}:`, real.join("; "));
    else if (r.errors.length) console.info(`[client-activity] ${a.kind}: bell stored for ${r.notified.length}; email/push held (not production)`);
  } catch (err) {
    console.error(`[client-activity] ${a.kind} on job ${a.jobId} failed`, err);
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function jobLabel(jobId: string): Promise<string | null> {
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { data } = await getSupabaseAdmin().from("jobs").select("job_number, job_name").eq("id", jobId).maybeSingle();
    const j = data as { job_number?: string | null; job_name?: string | null } | null;
    return j ? [j.job_number, j.job_name].filter(Boolean).join(" ") || null : null;
  } catch { return null; }
}
