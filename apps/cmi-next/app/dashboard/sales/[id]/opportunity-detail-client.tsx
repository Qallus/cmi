"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BriefcaseBusiness, ChevronLeft, ChevronRight, Clock, Loader2, Mail, MapPin, Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Select, Textarea } from "@/components/ui/input";
import { STAGE_META } from "@/lib/pipeline/stages";
import type { Opportunity, PipelineStage, StageHistoryRow } from "@/lib/pipeline/types";
import { StageBadge, StageRail } from "./stage-rail";

export type OwnerOption = { id: string; name: string };
export type OppContact = {
  id: string; name: string; email: string | null; phone: string | null; company: string | null;
};

type FieldKind = "text" | "number" | "money" | "date" | "percent" | "textarea" | "owner";
type Field = { key: keyof Opportunity; label: string; kind: FieldKind };

/**
 * The form, grouped the way the stages are.
 *
 * The record already stores its fields in stage order, so the tabs simply
 * follow it: each tab holds what that stage is for. That is the whole reason
 * the page reads without training — where you are on the rail tells you which
 * tab you are meant to be filling in.
 */
const TABS: { key: string; label: string; stage?: PipelineStage; fields: Field[] }[] = [
  {
    key: "opportunity", label: "Opportunity", stage: "opportunity",
    fields: [
      { key: "opportunity_name", label: "Opportunity name", kind: "text" },
      { key: "project_type", label: "Project type", kind: "text" },
      { key: "project_address", label: "Address", kind: "text" },
      { key: "city", label: "City", kind: "text" },
      { key: "state", label: "State", kind: "text" },
      { key: "zip_code", label: "ZIP", kind: "text" },
      { key: "estimated_project_value", label: "Estimated value", kind: "money" },
      { key: "estimated_budget_range", label: "Budget range", kind: "text" },
      { key: "probability_percent", label: "Probability", kind: "percent" },
      { key: "source", label: "Source", kind: "text" },
      { key: "referral_source", label: "Referral source", kind: "text" },
      { key: "assigned_owner_id", label: "Owner", kind: "owner" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "budget", label: "Active Budget", stage: "active_budget",
    fields: [
      { key: "budget_status", label: "Budget status", kind: "text" },
      { key: "budget_owner", label: "Budget owner", kind: "text" },
      { key: "budget_due_date", label: "Budget due", kind: "date" },
      { key: "last_budget_sent_date", label: "Last budget sent", kind: "date" },
      { key: "budget_revision_count", label: "Revisions", kind: "number" },
      { key: "current_budget_total", label: "Current budget total", kind: "money" },
      { key: "internal_estimated_cost", label: "Internal estimated cost", kind: "money" },
      { key: "projected_margin", label: "Projected margin", kind: "percent" },
    ],
  },
  {
    key: "design", label: "Pre-Con / Design", stage: "pre_construction_design",
    fields: [
      { key: "agreement_status", label: "Agreement status", kind: "text" },
      { key: "architect", label: "Architect", kind: "text" },
      { key: "designer", label: "Designer", kind: "text" },
      { key: "engineer", label: "Engineer", kind: "text" },
      { key: "permit_status", label: "Permit status", kind: "text" },
      { key: "procurement_status", label: "Procurement status", kind: "text" },
      { key: "projected_construction_start_date", label: "Projected start", kind: "date" },
      { key: "projected_construction_value", label: "Projected value", kind: "money" },
      { key: "forecast_probability_percent", label: "Forecast probability", kind: "percent" },
    ],
  },
  {
    key: "project", label: "Active Project", stage: "active_project",
    fields: [
      { key: "construction_agreement_status", label: "Construction agreement", kind: "text" },
      { key: "start_date", label: "Start date", kind: "date" },
      { key: "projected_completion_date", label: "Projected completion", kind: "date" },
      { key: "actual_completion_date", label: "Actual completion", kind: "date" },
      { key: "project_manager", label: "Project manager", kind: "text" },
      { key: "superintendent", label: "Superintendent", kind: "text" },
      { key: "project_status", label: "Project status", kind: "text" },
      { key: "contract_value", label: "Contract value", kind: "money" },
      { key: "approved_change_orders_total", label: "Approved change orders", kind: "money" },
      { key: "current_project_value", label: "Current project value", kind: "money" },
    ],
  },
  {
    key: "warranty", label: "Warranty", stage: "warranty",
    fields: [
      { key: "warranty_start_date", label: "Warranty starts", kind: "date" },
      { key: "warranty_expiration_date", label: "Warranty expires", kind: "date" },
      { key: "warranty_period_months", label: "Period (months)", kind: "number" },
      { key: "warranty_status", label: "Warranty status", kind: "text" },
    ],
  },
  {
    key: "closed", label: "Closeout", stage: "closed",
    fields: [
      { key: "closed_date", label: "Closed date", kind: "date" },
      { key: "final_contract_value", label: "Final contract value", kind: "money" },
      { key: "final_project_value", label: "Final project value", kind: "money" },
      { key: "final_margin", label: "Final margin", kind: "percent" },
      { key: "closeout_notes", label: "Closeout notes", kind: "textarea" },
      { key: "long_lead_reason", label: "Long-lead reason", kind: "text" },
      { key: "follow_up_date", label: "Follow-up date", kind: "date" },
      { key: "lost_reason", label: "Lost reason", kind: "text" },
      { key: "lost_to_builder", label: "Lost to", kind: "text" },
    ],
  },
];

const money = (n: number | null) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US")}`);
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function OpportunityDetailClient({
  opportunity: initial, contact, owners, history, siblingIds, canWrite, isAdmin,
}: {
  opportunity: Opportunity;
  contact: OppContact | null;
  owners: OwnerOption[];
  history: StageHistoryRow[];
  siblingIds: string[];
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [opp, setOpp] = React.useState(initial);
  // The tab you land on is the one for the stage you are in, so the page opens
  // showing the work that is actually current.
  const [tab, setTab] = React.useState(() => TABS.find((t) => t.stage === initial.stage)?.key ?? "opportunity");
  const [saving, setSaving] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const at = siblingIds.indexOf(opp.id);
  const prevId = at > 0 ? siblingIds[at - 1] : null;
  const nextId = at >= 0 && at < siblingIds.length - 1 ? siblingIds[at + 1] : null;

  /** Save one field on blur — the same pattern the Pipeline list uses. */
  const saveField = React.useCallback(async (key: keyof Opportunity, value: unknown) => {
    if (opp[key] === value) return;
    setSaving(key as string);
    const before = opp;
    setOpp((o) => ({ ...o, [key]: value } as Opportunity));
    const res = await fetch(`/api/pipeline/${opp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSaving(null);
    if (!res.ok) {
      setOpp(before);
      const json = await res.json().catch(() => ({}));
      setToast(json.error ?? "Could not save.");
    }
  }, [opp]);

  const advance = React.useCallback(async (
    to: PipelineStage, patch: Record<string, unknown>, note: string | null,
  ): Promise<string | null> => {
    const res = await fetch(`/api/pipeline/${opp.id}/transition`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, patch, note }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const missing = Array.isArray(json.missing) && json.missing.length ? ` Missing: ${json.missing.join(", ")}.` : "";
      return `${json.error ?? "Could not move it."}${missing}`;
    }
    setOpp(json as Opportunity);
    setTab(TABS.find((t) => t.stage === (json as Opportunity).stage)?.key ?? tab);
    setToast(`Moved to ${STAGE_META[to].label}.`);
    router.refresh();
    return null;
  }, [opp.id, router, tab]);

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background">
      <div className="border-b border-border px-4 py-3 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/dashboard/sales?tab=opportunities")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Pre-Con
          </button>
          {at >= 0 && siblingIds.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="hidden text-xs text-muted-foreground sm:inline">{at + 1} of {siblingIds.length}</span>
              <button
                type="button" disabled={!prevId} aria-label="Previous opportunity"
                onClick={() => prevId && router.push(`/dashboard/sales/${prevId}`)}
                className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button" disabled={!nextId} aria-label="Next opportunity"
                onClick={() => nextId && router.push(`/dashboard/sales/${nextId}`)}
                className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Pre-Con
                {opp.job_number && <span className="font-mono normal-case tracking-normal">{opp.job_number}</span>}
              </div>
              <h1 className="font-display text-2xl font-semibold">{opp.opportunity_name}</h1>
            </div>
          </div>
          <StageBadge stage={opp.stage} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border p-4 md:grid-cols-4">
          <Summary label="Value">{money(opp.current_project_value ?? opp.contract_value ?? opp.estimated_project_value)}</Summary>
          <Summary label="Probability">{opp.probability_percent != null ? `${opp.probability_percent}%` : "—"}</Summary>
          <Summary label="Owner">{owners.find((o) => o.id === opp.assigned_owner_id)?.name ?? opp.assigned_owner ?? "Unassigned"}</Summary>
          <Summary label="Start">{when(opp.start_date ?? opp.projected_construction_start_date)}</Summary>
          {contact && (
            <Summary label="Contact">
              <span className="flex flex-wrap items-center gap-x-3">
                {contact.name}
                {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Phone className="h-3 w-3" />{contact.phone}</a>}
                {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Mail className="h-3 w-3" />{contact.email}</a>}
              </span>
            </Summary>
          )}
          {(opp.project_address || opp.city) && (
            <Summary label="Address">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {[opp.project_address, opp.city, opp.state].filter(Boolean).join(", ")}
              </span>
            </Summary>
          )}
        </div>
      </div>

      <div className="space-y-5 p-4 md:p-6">
        <StageRail opportunity={opp} canWrite={canWrite} onAdvance={advance} />

        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-sm">
          {TABS.map((t) => {
            const isStageTab = t.stage === opp.stage;
            return (
              <button
                key={t.key} type="button" onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition",
                  tab === t.key ? "bg-accent text-accent-foreground"
                    : isStageTab ? "text-accent hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t.label}
                {isStageTab && tab !== t.key && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </button>
            );
          })}
          <button
            type="button" onClick={() => setTab("history")}
            className={cn("ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition",
              tab === "history" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            <Clock className="h-3.5 w-3.5" /> History
          </button>
        </div>

        {tab === "history" ? (
          <History rows={history} />
        ) : (
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{active.label}</h2>
              {active.stage && (
                <p className="text-xs text-muted-foreground">{STAGE_META[active.stage].description}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.fields.map((f) => (
                <FieldInput
                  key={f.key as string}
                  field={f}
                  value={opp[f.key]}
                  owners={owners}
                  disabled={!canWrite}
                  saving={saving === (f.key as string)}
                  onSave={(v) => void saveField(f.key, v)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {!isAdmin && opp.stage === "closed" && (
        <p className="px-6 pb-6 text-xs text-muted-foreground">Reopening a closed project needs an admin.</p>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] max-w-[90vw] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm">{children}</div>
    </div>
  );
}

/** Save on blur, matching the rest of the app. */
function FieldInput({
  field, value, owners, disabled, saving, onSave,
}: {
  field: Field;
  value: unknown;
  owners: OwnerOption[];
  disabled: boolean;
  saving: boolean;
  onSave: (v: unknown) => void;
}) {
  const asString = value == null ? "" : String(value);
  const [draft, setDraft] = React.useState(asString);
  // Keyed remount on the value keeps the draft in step without an effect that
  // could overwrite typing mid-edit.
  const [seen, setSeen] = React.useState(asString);
  if (seen !== asString && document.activeElement?.getAttribute("data-field") !== field.key) {
    setSeen(asString);
    setDraft(asString);
  }

  const commit = () => {
    if (draft === asString) return;
    if (field.kind === "money" || field.kind === "number" || field.kind === "percent") {
      const clean = draft.replace(/[^0-9.\-]/g, "");
      onSave(clean === "" ? null : Number(clean));
      return;
    }
    onSave(draft.trim() === "" ? null : draft.trim());
  };

  const label = (
    <span className="mb-1 flex items-center gap-1.5 text-xs font-medium">
      {field.label}
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </span>
  );

  if (field.kind === "owner") {
    return (
      <label className="block">
        {label}
        <Select
          disabled={disabled} value={asString}
          onChange={(e) => onSave(e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </label>
    );
  }

  if (field.kind === "textarea") {
    return (
      <label className="block sm:col-span-2 lg:col-span-3">
        {label}
        <Textarea
          data-field={field.key as string}
          disabled={disabled} className="min-h-[80px]"
          value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        />
      </label>
    );
  }

  return (
    <label className="block">
      {label}
      <Input
        data-field={field.key as string}
        disabled={disabled}
        type={field.kind === "date" ? "date" : "text"}
        inputMode={field.kind === "money" || field.kind === "number" || field.kind === "percent" ? "decimal" : undefined}
        placeholder={field.kind === "money" ? "$" : field.kind === "percent" ? "%" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
    </label>
  );
}

function History({ rows }: { rows: StageHistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No stage changes recorded yet.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {[...rows].reverse().map((h) => (
        <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
          {h.from_stage && <><StageBadge stage={h.from_stage as PipelineStage} /><span className="text-muted-foreground">→</span></>}
          <StageBadge stage={h.to_stage as PipelineStage} />
          <span className="text-xs text-muted-foreground">
            {new Date(h.changed_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            {h.changed_by ? ` · ${h.changed_by}` : ""}
          </span>
          {h.note && <span className="w-full text-xs text-muted-foreground">{h.note}</span>}
        </li>
      ))}
    </ol>
  );
}
