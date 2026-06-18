"use client";

import * as React from "react";

export const DYNAMIC_FIELDS = [
  { label: "First Name", token: "{first_name}" },
  { label: "Last Name",  token: "{last_name}" },
  { label: "Full Name",  token: "{full_name}" },
  { label: "Email",      token: "{email}" },
  { label: "Phone",      token: "{phone}" },
  { label: "Company",    token: "{company}" },
  { label: "Address",    token: "{address}" },
  { label: "City",       token: "{city}" },
  { label: "State",      token: "{state}" },
  { label: "Zip",        token: "{zip}" },
] as const;

export function DynamicFieldsBar({
  onInsert,
  clipboard = false,
}: {
  /** Called with the token string when a chip is clicked. */
  onInsert: (token: string) => void;
  /** When true, also copies the token to the clipboard and shows "Copied!" feedback. */
  clipboard?: boolean;
}) {
  const [copied, setCopied] = React.useState<string | null>(null);

  function handleClick(token: string) {
    onInsert(token);
    if (clipboard) {
      navigator.clipboard.writeText(token).catch(() => {});
      setCopied(token);
      setTimeout(() => setCopied(null), 1200);
    }
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-muted/20 px-3 py-1.5 scrollbar-none shrink-0">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Fields:
      </span>
      {DYNAMIC_FIELDS.map(({ label, token }) => (
        <button
          key={token}
          type="button"
          onClick={() => handleClick(token)}
          title={token}
          className="shrink-0 rounded border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:border-accent/50 hover:bg-accent/10 hover:text-accent"
        >
          {copied === token ? "Copied!" : label}
        </button>
      ))}
      {clipboard && (
        <span className="ml-1 shrink-0 text-[10px] text-muted-foreground">
          -- Click to copy, then paste into a block
        </span>
      )}
    </div>
  );
}
