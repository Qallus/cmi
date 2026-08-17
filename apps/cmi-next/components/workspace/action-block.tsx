"use client";

import * as React from "react";
import { createPlatePlugin, PlateElement, useEditorRef, usePath } from "platejs/react";
import { MessageSquare, MessageCircle, Mail, CalendarClock, Send, Check, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/workspace/ui/dialog";
import { Button } from "@/components/workspace/ui/button";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A void block that dispatches a real action (in-app DM, Twilio SMS, staff
// email, or a schedule/calendar entry) when the user clicks Send and confirms.
// Data lives on the node, so a sent action is recorded in the document.
export const WorkspaceActionPlugin = createPlatePlugin({ key: "workspace_action", node: { isElement: true, isVoid: true } });

export type ActionKind = "dm" | "sms" | "email" | "schedule";
export function newActionNode(kind: ActionKind) {
  return { type: WorkspaceActionPlugin.key, kind, targetId: null, targetName: "", toPhone: "", subject: "", message: "", date: "", time: "", status: "draft", children: [{ text: "" }] };
}

const KIND_META: Record<ActionKind, { label: string; verb: string; icon: any; color: string }> = {
  dm: { label: "Direct Message", verb: "Send DM", icon: MessageSquare, color: "#5b7a8c" },
  sms: { label: "SMS", verb: "Send SMS", icon: MessageCircle, color: "#2f6f5e" },
  email: { label: "Email", verb: "Send Email", icon: Mail, color: "#9e6f2e" },
  schedule: { label: "Schedule", verb: "Add to Schedule", icon: CalendarClock, color: "#9B2F2E" },
};

let STAFF_CACHE: { id: string; name: string }[] | null = null;
function useStaff() {
  const [staff, setStaff] = React.useState<{ id: string; name: string }[]>(STAFF_CACHE ?? []);
  React.useEffect(() => {
    if (STAFF_CACHE) return;
    fetch("/api/workspace/users").then((r) => r.json()).then((d) => { if (d.ok) { STAFF_CACHE = d.users; setStaff(d.users); } }).catch(() => {});
  }, []);
  return staff;
}

export function ActionElement(props: any) {
  const editor = useEditorRef();
  const path = usePath();
  const el = props.element ?? {};
  const kind = (el.kind ?? "dm") as ActionKind;
  const meta = KIND_META[kind];
  const staff = useStaff();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = (patch: Record<string, unknown>) => { try { editor.tf?.setNodes?.(patch, { at: path }); } catch { /* no-op */ } };
  const sent = el.status === "sent";
  const targetName = el.targetName || staff.find((s) => s.id === el.targetId)?.name || "";
  const needsTarget = kind === "sms" ? !el.targetId && !el.toPhone : !el.targetId;
  const canSend = !sent && !needsTarget && (kind === "schedule" ? !!el.date : !!(el.message || "").trim());

  async function dispatch() {
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/workspace/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, targetId: el.targetId || null, toPhone: el.toPhone || null, subject: el.subject || null, message: el.message || "", date: el.date || null, time: el.time || null }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Action failed."); return; }
      save({ status: "sent", sentAt: new Date().toISOString() });
      setConfirmOpen(false);
    } catch { setError("Action failed. Please try again."); }
    finally { setSending(false); }
  }

  const confirmText: Record<ActionKind, string> = {
    dm: `Send an in-app direct message to ${targetName || "the selected staff member"}?`,
    sms: `Send a text message (SMS) to ${targetName || el.toPhone || "the recipient"}?`,
    email: `Send an email to ${targetName || "the selected staff member"}?`,
    schedule: `Add "${(el.message || "Untitled").slice(0, 60)}" to ${targetName || "the selected staff member"}'s schedule${el.date ? ` on ${el.date}` : ""}?`,
  };

  return (
    <PlateElement {...props}>
      <div contentEditable={false} className="my-3 select-none rounded-lg border bg-card p-3 shadow-sm" style={{ borderLeft: `3px solid ${meta.color}` }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: meta.color }}><meta.icon className="h-4 w-4" /> {meta.label}</span>
          {sent ? <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"><Check className="h-3 w-3" /> Sent</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Draft</span>}
        </div>

        {sent ? (
          <div className="text-sm text-muted-foreground">
            {meta.verb} to <span className="font-medium text-foreground">{targetName || el.toPhone}</span>
            {el.message ? <>: “{el.message}”</> : null}
            {kind === "schedule" && el.date ? <> · {el.date}{el.time ? ` ${el.time}` : ""}</> : null}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground">{kind === "schedule" ? "Whose schedule" : "To"}</label>
              <select value={el.targetId ?? ""} onChange={(e) => { const s = staff.find((x) => x.id === e.target.value); save({ targetId: e.target.value || null, targetName: s?.name ?? "" }); }} className="h-8 min-w-[10rem] rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent">
                <option value="">Select staff…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {kind === "sms" ? (
                <input value={el.toPhone ?? ""} onChange={(e) => save({ toPhone: e.target.value })} placeholder="or type a phone #" className="h-8 w-40 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
              ) : null}
            </div>

            {kind === "email" ? (
              <input value={el.subject ?? ""} onChange={(e) => save({ subject: e.target.value })} placeholder="Subject" className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
            ) : null}

            {kind === "schedule" ? (
              <div className="flex flex-wrap gap-2">
                <input type="date" value={el.date ?? ""} onChange={(e) => save({ date: e.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
                <input type="time" value={el.time ?? ""} onChange={(e) => save({ time: e.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
              </div>
            ) : null}

            <textarea value={el.message ?? ""} onChange={(e) => save({ message: e.target.value })} rows={2} placeholder={kind === "schedule" ? "What to schedule…" : "Message…"} className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent" />

            <div className="flex items-center justify-end">
              <Button size="sm" variant="default" disabled={!canSend} onClick={() => { setError(null); setConfirmOpen(true); }}><Send className="h-3.5 w-3.5" /> {meta.verb}</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><meta.icon className="h-4 w-4" style={{ color: meta.color }} /> Confirm {meta.label}</DialogTitle><DialogDescription>{confirmText[kind]}</DialogDescription></DialogHeader>
          {el.message && kind !== "schedule" ? <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{el.message}</div> : null}
          {error ? <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {error}</p> : null}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={sending}>Cancel</Button>
            <Button variant="default" size="sm" onClick={() => void dispatch()} disabled={sending}>{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {sending ? "Sending…" : "Confirm & Send"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {props.children}
    </PlateElement>
  );
}
