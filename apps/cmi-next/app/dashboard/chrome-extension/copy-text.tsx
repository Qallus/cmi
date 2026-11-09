"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

// Web pages can't link to chrome:// addresses, so this copies one for pasting.
export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); }}
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm transition hover:border-accent">
      <span className="truncate">{text}</span>
      {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      <span className="text-xs text-muted-foreground">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
