"use client";

import * as React from "react";
import { Check, MessageSquare, X } from "lucide-react";
import type { ProjectSelection } from "@/lib/selections/types";

export type ClientAction = "approved" | "rejected" | "comment";

const DECIDED = ["approved", "approved_with_changes", "rejected", "revision_requested"];

/** Whether the client is asked for a yes / no on this selection. */
export function asksForDecision(s: ProjectSelection): boolean {
  return Boolean(s.client_approval_required) || s.approval_status === "pending" || DECIDED.includes(s.approval_status);
}

// The client's side of a selection in their portal: Approve (with an optional
// note), Not approved (with what they'd like instead), or just a comment. Once
// decided they can still comment, or change their decision.
export function ClientResponse({ selection: s, busy, error, onSubmit, size = "sm" }: {
  selection: ProjectSelection;
  busy?: boolean;
  error?: string | null;
  /** Resolves true when it saved (the form then closes). */
  onSubmit: (action: ClientAction, comment: string) => Promise<boolean>;
  size?: "sm" | "md";
}) {
  const [mode, setMode] = React.useState<ClientAction | null>(null);
  const [text, setText] = React.useState("");
  const [changing, setChanging] = React.useState(false);
  const decided = DECIDED.includes(s.approval_status);
  const canDecide = asksForDecision(s) && (!decided || changing);

  const pad = size === "md" ? "px-5 py-2" : "px-3 py-1.5";
  const primary = `inline-flex items-center gap-1.5 rounded-lg bg-accent ${pad} text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60`;
  const outline = `inline-flex items-center gap-1.5 rounded-lg border border-border ${pad} text-sm font-semibold transition hover:border-accent/40 disabled:opacity-60`;

  async function send() {
    if (!mode) return;
    if (await onSubmit(mode, text.trim())) { setMode(null); setText(""); setChanging(false); }
  }

  if (mode) {
    const needsText = mode !== "approved";
    const placeholder = mode === "approved" ? "Add a note for your team (optional)" : mode === "rejected" ? "What would you like instead?" : "Your comment or question";
    const label = mode === "approved" ? "Approve" : mode === "rejected" ? "Send: not approved" : "Send comment";
    return (
      <div className="space-y-2">
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => { setMode(null); setText(""); }} className={outline}>Cancel</button>
          <button type="button" disabled={busy || (needsText && !text.trim())} onClick={() => void send()} className={primary}>
            {mode === "approved" ? <Check className="h-4 w-4" /> : null}{label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canDecide ? (
        <>
          <button type="button" disabled={busy} onClick={() => setMode("approved")} className={primary}><Check className="h-4 w-4" /> Approve</button>
          <button type="button" disabled={busy} onClick={() => setMode("rejected")} className={outline}><X className="h-4 w-4" /> Not approved</button>
        </>
      ) : null}
      <button type="button" disabled={busy} onClick={() => setMode("comment")} className={outline}><MessageSquare className="h-4 w-4" /> Comment</button>
      {decided && !changing && asksForDecision(s) ? (
        <button type="button" onClick={() => setChanging(true)} className="text-xs font-medium text-accent hover:underline">Change my decision</button>
      ) : null}
    </div>
  );
}
