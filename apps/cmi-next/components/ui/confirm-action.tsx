"use client";

// CMI-branded replacements for window.confirm (confirmAction) and window.prompt
// (promptText). confirmAction is called the same way as confirm —
//   if (!(await confirmAction({ title: "Delete 2 jobs?", body: "…", tone: "danger" }))) return;
// — and it renders a centered, on-brand dialog instead of the browser's.
// Escape or a click outside cancels; Enter presses the focused button (Cancel, for a delete).
import * as React from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, Archive, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" = permanent delete (red), "archive" = reversible, "default" = neutral. */
  tone?: "danger" | "archive" | "default";
};

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (ok: boolean) => {
      resolve(ok);
      root.unmount();
      host.remove();
    };
    root.render(<ConfirmDialog {...opts} onDone={done} />);
  });
}

export type PromptOptions = {
  title: string;
  label?: string;
  body?: React.ReactNode;
  initial?: string;
  placeholder?: string;
  submitLabel?: string;
  /** Leave the box empty to submit? Off by default. */
  allowEmpty?: boolean;
};

// CMI-branded replacement for window.prompt. Resolves with the trimmed text,
// or null when cancelled:
//   const name = await promptText({ title: "New phase", label: "Phase name" }); if (!name) return;
export function promptText(opts: PromptOptions): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (value: string | null) => {
      resolve(value);
      root.unmount();
      host.remove();
    };
    root.render(<PromptDialog {...opts} onDone={done} />);
  });
}

function PromptDialog({
  title, label, body, initial = "", placeholder, submitLabel = "Save", allowEmpty = false, onDone,
}: PromptOptions & { onDone: (value: string | null) => void }) {
  const [value, setValue] = React.useState(initial);
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    input.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onDone(null); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone]);
  const ok = allowEmpty || value.trim().length > 0;
  const submit = () => { if (ok) onDone(value.trim()); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => onDone(null)} />
      <form role="dialog" aria-modal="true" aria-label={title} onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-2.5">
          <img src="/brand/cmi-mark.svg" alt="" className="h-5 w-5 object-contain dark:invert" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Constructed Matter</span>
        </div>
        <div className="p-5">
          <h2 className="font-display text-lg font-semibold leading-snug">{title}</h2>
          {body && <div className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{body}</div>}
          <label className="mt-4 block">
            {label && <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>}
            <Input ref={input} autoFocus value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" size="sm" variant="ghost" onClick={() => onDone(null)}>Cancel</Button>
          <Button type="submit" size="sm" variant="accent" disabled={!ok}>{submitLabel}</Button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDialog({
  title, body, confirmLabel, cancelLabel = "Cancel", tone = "default", onDone,
}: ConfirmOptions & { onDone: (ok: boolean) => void }) {
  const [closing, setClosing] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onDone(false); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone]);

  const Icon = tone === "danger" ? Trash2 : tone === "archive" ? Archive : AlertTriangle;
  const label = confirmLabel ?? (tone === "danger" ? "Delete" : tone === "archive" ? "Archive" : "Confirm");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => onDone(false)} />
      <div role="alertdialog" aria-modal="true" aria-label={title}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-2.5">
          <img src="/brand/cmi-mark.svg" alt="" className="h-5 w-5 object-contain dark:invert" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Constructed Matter</span>
        </div>
        <div className="flex items-start gap-3 p-5">
          <span className={
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
            (tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-accent/15 text-accent")
          }>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold leading-snug">{title}</h2>
            {body && <div className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{body}</div>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {/* A delete starts focused on Cancel so a stray Enter can't destroy anything. */}
          <Button autoFocus={tone === "danger"} size="sm" variant="ghost" onClick={() => onDone(false)} disabled={closing}>{cancelLabel}</Button>
          <Button
            autoFocus={tone !== "danger"} size="sm" variant={tone === "danger" ? "destructive" : "accent"} disabled={closing}
            onClick={() => { setClosing(true); onDone(true); }}
          >
            {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />} {label}
          </Button>
        </div>
      </div>
    </div>
  );
}
