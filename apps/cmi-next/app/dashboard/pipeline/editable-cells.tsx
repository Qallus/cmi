"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEAL_STAGE_META, DEAL_STAGES } from "@/lib/deals/stages";
import type { Deal, DealStage } from "@/lib/deals/types";

export type OwnerOption = { id: string; name: string };

/**
 * Edit a deal from the list.
 *
 * `patch` covers ordinary columns; `setStage` is separate because a stage
 * change has to go through the stage route, which records history and runs the
 * Closed Won handoff. A plain PATCH would move the deal and lose both.
 */
export type CellEdit = {
  patch: (id: string, patch: Partial<Deal>) => Promise<string | null>;
  setStage: (id: string, to: DealStage) => Promise<string | null>;
  canWrite: boolean;
};

const CELL = "w-full rounded px-1.5 py-0.5 text-left transition";
const IDLE = "hover:bg-accent/10 hover:ring-1 hover:ring-accent/30";

/** Shared open/save/cancel behaviour, so every cell type feels the same. */
function useCell(save: () => Promise<string | null>, reset: () => void) {
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  async function commit() {
    setBusy(true);
    const err = await save();
    setBusy(false);
    setEditing(false);
    if (err) { setError(err); reset(); }
  }

  function cancel() { reset(); setEditing(false); }

  return { editing, setEditing, busy, error, commit, cancel };
}

function Err({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="mt-0.5 text-[10px] leading-tight text-destructive">{message}</div>;
}

export function TextCell({
  deal, field, value, placeholder, edit, className, mono,
}: {
  deal: Deal;
  field: keyof Deal;
  value: string | null;
  placeholder?: string;
  edit: CellEdit;
  className?: string;
  mono?: boolean;
}) {
  // Seeded when editing opens rather than synced from the prop: a background
  // refresh landing mid-edit must not overwrite what is being typed.
  const [draft, setDraft] = React.useState("");

  const cell = useCell(
    async () => (draft === (value ?? "") ? null : edit.patch(deal.id, { [field]: draft.trim() || null } as Partial<Deal>)),
    () => setDraft(value ?? ""),
  );
  const open = () => { setDraft(value ?? ""); cell.setEditing(true); };

  if (!edit.canWrite) return <span className={className}>{value || placeholder || "—"}</span>;

  if (cell.editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void cell.commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void cell.commit(); }
          if (e.key === "Escape") { e.preventDefault(); cell.cancel(); }
        }}
        className={cn("w-full rounded border border-accent bg-background px-1.5 py-0.5 text-sm outline-none", mono && "font-mono text-[11px]")}
      />
    );
  }

  return (
    <div>
      <button type="button" onClick={open} className={cn(CELL, IDLE, className)}>
        {cell.busy && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
        {value || <span className="text-muted-foreground">{placeholder ?? "—"}</span>}
      </button>
      <Err message={cell.error} />
    </div>
  );
}

export function MoneyCell({ deal, value, edit }: { deal: Deal; value: number | null; edit: CellEdit }) {
  const [draft, setDraft] = React.useState("");

  const cell = useCell(
    async () => {
      const clean = draft.replace(/[^0-9.]/g, "");
      const next = clean === "" ? null : Number(clean);
      if (next === value) return null;
      if (next !== null && !Number.isFinite(next)) return "Not a number.";
      return edit.patch(deal.id, { estimated_value: next });
    },
    () => setDraft(value == null ? "" : String(value)),
  );
  const open = () => { setDraft(value == null ? "" : String(value)); cell.setEditing(true); };

  const shown = value == null ? "—" : `$${Number(value).toLocaleString("en-US")}`;
  if (!edit.canWrite) return <span className="tabular-nums">{shown}</span>;

  if (cell.editing) {
    return (
      <input
        autoFocus inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void cell.commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void cell.commit(); }
          if (e.key === "Escape") { e.preventDefault(); cell.cancel(); }
        }}
        className="w-full rounded border border-accent bg-background px-1.5 py-0.5 text-right text-sm tabular-nums outline-none"
      />
    );
  }

  return (
    <div>
      <button type="button" onClick={open} className={cn(CELL, IDLE, "text-right tabular-nums")}>
        {cell.busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : shown}
      </button>
      <Err message={cell.error} />
    </div>
  );
}

export function OwnerCell({ deal, owners, edit }: { deal: Deal; owners: OwnerOption[]; edit: CellEdit }) {
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const name = owners.find((o) => o.id === deal.owner_id)?.name ?? "Unassigned";

  React.useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  if (!edit.canWrite) return <span className="text-muted-foreground">{name}</span>;

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={deal.owner_id ?? ""}
        onBlur={() => setEditing(false)}
        onChange={async (e) => {
          const next = e.target.value || null;
          setEditing(false);
          if (next === deal.owner_id) return;
          setBusy(true);
          setError(await edit.patch(deal.id, { owner_id: next }));
          setBusy(false);
        }}
        className="w-full rounded border border-accent bg-background px-1.5 py-0.5 text-sm outline-none"
      >
        <option value="">Unassigned</option>
        {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setEditing(true)} className={cn(CELL, IDLE, "text-muted-foreground")}>
        {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : name}
      </button>
      <Err message={error} />
    </div>
  );
}

/**
 * Stage, as a badge you can change.
 *
 * Goes through `setStage`, not `patch`: the stage route records history and
 * fires the Closed Won handoff, and Closed Won can legitimately refuse when
 * required fields are missing. That refusal is shown here rather than dropped.
 */
export function StageCell({ deal, edit, badge }: { deal: Deal; edit: CellEdit; badge: React.ReactNode }) {
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  if (!edit.canWrite) return <>{badge}</>;

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={deal.stage}
        onBlur={() => setEditing(false)}
        onChange={async (e) => {
          const to = e.target.value as DealStage;
          setEditing(false);
          if (to === deal.stage) return;
          setBusy(true);
          setError(await edit.setStage(deal.id, to));
          setBusy(false);
        }}
        className="w-full rounded border border-accent bg-background px-1.5 py-0.5 text-sm outline-none"
      >
        {DEAL_STAGES.map((st) => (
          <option key={st} value={st}>{DEAL_STAGE_META[st]?.label ?? st}</option>
        ))}
      </select>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setEditing(true)} className={cn("rounded px-0.5 transition", IDLE)}>
        {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : badge}
      </button>
      <Err message={error} />
    </div>
  );
}
