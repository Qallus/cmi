"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Select } from "@/components/ui/input";
import {
  ALLOWED_TRANSITIONS, FIELD_LABELS, STAGE_META, requiredFieldsForStage,
} from "@/lib/pipeline/stages";
import type { Opportunity, PipelineStage } from "@/lib/pipeline/types";

/** The happy path, left to right. Alternate stages are offered separately. */
const MAIN_PATH: PipelineStage[] = [
  "opportunity", "active_budget", "pre_construction_design", "active_project", "warranty", "closed",
];

const TONE: Record<string, string> = {
  info: "bg-info/15 text-info",
  accent: "bg-accent/15 text-accent",
  success: "bg-emerald-600/18 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function StageBadge({ stage }: { stage: PipelineStage }) {
  const meta = STAGE_META[stage];
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TONE[meta.tone] ?? TONE.muted)}>
      {meta.label}
    </span>
  );
}

/**
 * Where this opportunity is, and what it takes to move it on.
 *
 * The point of the rail is that the answer to "what do I do next" is on screen
 * without being taught: the path is drawn, the current step is marked, and the
 * next step names the fields it needs before it will accept the move.
 */
export function StageRail({
  opportunity, canWrite, onAdvance,
}: {
  opportunity: Opportunity;
  canWrite: boolean;
  onAdvance: (to: PipelineStage, patch: Record<string, unknown>, note: string | null) => Promise<string | null>;
}) {
  const current = opportunity.stage;
  const currentOrder = STAGE_META[current].order;
  const onMainPath = MAIN_PATH.includes(current);

  const [target, setTarget] = React.useState<PipelineStage | null>(null);

  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  const forward = allowed.filter((s) => MAIN_PATH.includes(s));
  const alternate = allowed.filter((s) => !MAIN_PATH.includes(s));

  return (
    <div className="space-y-4">
      {/* The path */}
      <ol className="flex flex-wrap items-center gap-1.5">
        {MAIN_PATH.map((stage, i) => {
          const meta = STAGE_META[stage];
          const isCurrent = stage === current;
          const isPast = onMainPath && meta.order < currentOrder;
          return (
            <li key={stage} className="flex items-center gap-1.5">
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
                  isCurrent ? "border-accent bg-accent text-accent-foreground font-semibold"
                    : isPast ? "border-accent/40 text-accent"
                    : "border-border text-muted-foreground",
                )}
              >
                <span className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                  isCurrent ? "bg-accent-foreground/20" : isPast ? "bg-accent/15" : "bg-muted",
                )}>
                  {isPast ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {meta.label}
              </div>
              {i < MAIN_PATH.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
            </li>
          );
        })}
      </ol>

      {/* Off-path stages are stated plainly rather than hidden. */}
      {!onMainPath && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          This one is <strong>{STAGE_META[current].label}</strong> — off the main path. {STAGE_META[current].description}
        </p>
      )}

      {canWrite && (forward.length > 0 || alternate.length > 0) && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Move this forward
          </div>
          <div className="flex flex-wrap gap-2">
            {forward.map((stage) => (
              <button
                key={stage} type="button" onClick={() => setTarget(stage)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  target === stage ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent hover:bg-accent/20",
                )}
              >
                {STAGE_META[stage].label} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ))}
            {alternate.map((stage) => (
              <button
                key={stage} type="button" onClick={() => setTarget(stage)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition",
                  target === stage ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {STAGE_META[stage].label}
              </button>
            ))}
          </div>

          {target && (
            <AdvanceForm
              key={target}
              opportunity={opportunity}
              to={target}
              onCancel={() => setTarget(null)}
              onAdvance={onAdvance}
            />
          )}
        </div>
      )}
    </div>
  );
}

const DATE_FIELDS = new Set([
  "start_date", "actual_completion_date", "warranty_start_date",
  "warranty_expiration_date", "closed_date", "follow_up_date",
]);

/**
 * The fields the target stage insists on, asked for up front.
 *
 * The API refuses a transition that is missing them. Asking here, with the
 * button disabled until they are answered, turns that refusal into something
 * you never hit.
 */
function AdvanceForm({
  opportunity, to, onCancel, onAdvance,
}: {
  opportunity: Opportunity;
  to: PipelineStage;
  onCancel: () => void;
  onAdvance: (to: PipelineStage, patch: Record<string, unknown>, note: string | null) => Promise<string | null>;
}) {
  const required = requiredFieldsForStage(to);
  const missing = required.filter((f) => {
    const v = opportunity[f];
    return v === null || v === undefined || v === "";
  });

  const [values, setValues] = React.useState<Record<string, string>>({});
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ready = missing.every((f) => (values[f as string] ?? "").trim() !== "");

  async function go() {
    setBusy(true); setError(null);
    const patch: Record<string, unknown> = {};
    for (const f of missing) patch[f as string] = values[f as string]?.trim();
    const err = await onAdvance(to, patch, note.trim() || null);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm">
        Moving to <strong>{STAGE_META[to].label}</strong>. {STAGE_META[to].description}
      </p>

      {missing.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {STAGE_META[to].label} needs {missing.length === 1 ? "one more thing" : `${missing.length} more things`} first:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {missing.map((field) => {
              const key = field as string;
              return (
                <label key={key} className="block space-y-1">
                  <span className="text-xs font-medium">{FIELD_LABELS[key] ?? key.replace(/_/g, " ")}</span>
                  {DATE_FIELDS.has(key) ? (
                    <Input type="date" value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
                  ) : key === "lost_reason" ? (
                    <Select value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}>
                      <option value="">Choose a reason…</option>
                      {["Price", "Timing", "Went with another builder", "Project cancelled", "No response", "Other"].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
                  )}
                </label>
              );
            })}
          </div>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Everything this stage needs is already on file.
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-medium">Note (optional)</span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it moved, for the history" />
      </label>

      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted">
          Cancel
        </button>
        <button
          type="button" disabled={busy || !ready} onClick={() => void go()}
          title={ready ? undefined : "Fill in what this stage needs first"}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Move to {STAGE_META[to].label}
        </button>
      </div>
    </div>
  );
}
