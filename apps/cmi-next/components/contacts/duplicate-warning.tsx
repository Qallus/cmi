"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Users, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DuplicateMatch = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  type: string | null;
  score: number;
  reason: string;
};

const name = (m: DuplicateMatch) => `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Unnamed contact";

/**
 * Watches what's being typed into a contact form and reports anyone already on
 * file who looks like the same person. Debounced and abortable, like the
 * global search box.
 *
 * Returns the matches so the parent can decide what to do on submit — this
 * hook never blocks anything by itself.
 */
export function useDuplicateCheck(input: {
  first?: string; last?: string; email?: string; phone?: string; company?: string; excludeId?: string;
}, enabled = true) {
  const [matches, setMatches] = React.useState<DuplicateMatch[]>([]);
  const [checking, setChecking] = React.useState(false);

  const { first = "", last = "", email = "", phone = "", company = "", excludeId = "" } = input;

  React.useEffect(() => {
    if (!enabled) { return; }
    const name = `${first}${last}`.trim();
    const digits = phone.replace(/\D/g, "");
    // Not enough typed yet to say anything useful.
    if (name.length < 2 && digits.length < 10 && !email.includes("@")) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const params = new URLSearchParams();
        if (first) params.set("first", first);
        if (last) params.set("last", last);
        if (email) params.set("email", email);
        if (phone) params.set("phone", phone);
        if (company) params.set("company", company);
        if (excludeId) params.set("exclude", excludeId);
        const res = await fetch(`/api/contacts/duplicates?${params}`, { signal: controller.signal });
        const json = await res.json().catch(() => ({}));
        setMatches(res.ok ? (json.matches ?? []) : []);
      } catch {
        // An aborted request is the normal case while someone keeps typing.
      } finally {
        setChecking(false);
      }
    }, 300);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [first, last, email, phone, company, excludeId, enabled]);

  // Nothing typed yet, or below the threshold — report no matches.
  const nameLen = `${first}${last}`.trim().length;
  const quiet = nameLen < 2 && phone.replace(/\D/g, "").length < 10 && !email.includes("@");

  return {
    matches: quiet ? [] : matches,
    checking,
    /** An email that's already taken — the save will fail until it changes. */
    blocking: (quiet ? [] : matches).find((m) => m.score >= 100) ?? null,
    /** Strong enough to stop and look, but a person can overrule it. */
    strong: (quiet ? [] : matches).find((m) => m.score >= 75) ?? null,
  };
}

/**
 * The panel itself. `onUse` is offered when the parent can switch to an
 * existing contact instead of creating one (the Pipeline form can; the
 * Contacts page just links across).
 */
export function DuplicateWarning({
  matches, checking, onUse, className,
}: {
  matches: DuplicateMatch[];
  checking?: boolean;
  onUse?: (match: DuplicateMatch) => void;
  className?: string;
}) {
  if (checking && matches.length === 0) {
    return (
      <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" /> Checking for an existing contact…
      </p>
    );
  }
  if (matches.length === 0) return null;

  const worst = matches[0].score;
  const certain = worst >= 100;
  const strong = worst >= 75;

  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border p-3",
        certain ? "border-destructive/40 bg-destructive/10"
          : strong ? "border-amber-500/40 bg-amber-500/10"
          : "border-border bg-muted/40",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium">
        {strong ? <AlertTriangle className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
        {certain
          ? "That email address is already in use"
          : strong
            ? `Already in Contacts — ${matches.length === 1 ? "this may be the same person" : "these may be the same person"}`
            : `${matches.length} similar contact${matches.length === 1 ? "" : "s"} — worth a look`}
      </p>

      <ul className="mt-2 space-y-1.5">
        {matches.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{name(m)}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {[m.email, m.phone, m.company, m.type].filter(Boolean).join(" · ")}
              </span>
              <span className="text-[11px] text-muted-foreground">Matched on {m.reason}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {onUse && (
                <button
                  type="button" onClick={() => onUse(m)}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                >
                  Use this one
                </button>
              )}
              <Link
                href={`/dashboard/contacts?focus=${m.id}`} target="_blank"
                title="Open this contact in a new tab"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
