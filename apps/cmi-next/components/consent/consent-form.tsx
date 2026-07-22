"use client";

import * as React from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { ConsentCategory } from "@/lib/messaging/consent";

export type ConsentOption = {
  /** Stable id for this choice. */
  value: string;
  /**
   * How this choice maps onto the suppression model. "Stop all messages"
   * covers both categories; a marketing-only choice covers just marketing.
   */
  categories: ConsentCategory[];
  /** Bold lead-in — the operative consent sentence. */
  title: string;
  /** Supporting description. */
  body?: string;
  /** Rate / frequency / STOP disclosure shown under the choice. */
  fineprint?: string;
};

export type ConsentFieldConfig = {
  name?: "required" | "optional";
  email?: "required" | "optional";
  phone?: "required" | "optional";
  company?: "optional";
  relationship?: "optional";
};

export const RELATIONSHIP_OPTIONS = [
  "Prospective Client",
  "Client",
  "Property Owner",
  "General Contractor",
  "Subcontractor",
  "Designer",
  "Architect",
  "Engineer",
  "Consultant",
  "Vendor",
  "Supplier",
  "Government or Permit Representative",
  "Other",
];

/**
 * Success copy. Expressed as data rather than a render function because these
 * pages are Server Components — functions cannot cross the server/client
 * boundary, but ReactNode can.
 */
export type ConsentConfirmation = {
  heading: string;
  body: React.ReactNode;
  /**
   * Overrides applied when the selected option values exactly match
   * `whenValues`. First match wins.
   */
  variants?: Array<{ whenValues: string[]; heading?: string; body?: React.ReactNode }>;
};

type Props = {
  channel: "sms" | "email";
  mode: "opt_in" | "opt_out";
  fields: ConsentFieldConfig;
  options: ConsentOption[];
  /** Legend for the choice group. */
  optionsLegend: string;
  optionsHint?: string;
  submitLabel: string;
  /** Rendered above the submit button. */
  acknowledgment?: React.ReactNode;
  /** Heading + body shown once the submission succeeds. */
  confirmation: ConsentConfirmation;
};

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}

const inputClass =
  "cmi-form-control w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-ring";

export function ConsentForm({
  channel,
  mode,
  fields,
  options,
  optionsLegend,
  optionsHint,
  submitLabel,
  acknowledgment,
  confirmation,
}: Props) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = React.useState("");
  const [confirmed, setConfirmed] = React.useState<ConsentOption[]>([]);
  const errorRef = React.useRef<HTMLDivElement | null>(null);
  const successRef = React.useRef<HTMLDivElement | null>(null);

  const toggle = (value: string) =>
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  // Move focus to whichever result the submit produced, so screen-reader and
  // keyboard users are not left at the bottom of a form that visually changed.
  React.useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = (name: string) =>
      ((form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "").trim();

    const chosen = options.filter((o) => selected.includes(o.value));
    if (chosen.length === 0) {
      setError(
        mode === "opt_in"
          ? "Select at least one message type to continue."
          : "Select what you would like to stop receiving.",
      );
      errorRef.current?.focus();
      return;
    }

    setStatus("loading");
    setError("");

    // Capture the exact wording the user saw, so the stored consent record can
    // be reproduced verbatim later.
    const disclosureText = chosen
      .map((o) => [o.title, o.body, o.fineprint].filter(Boolean).join(" "))
      .join("\n\n");

    const address = channel === "sms" ? value("phone") : value("email");

    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          action: mode,
          address,
          categories: Array.from(new Set(chosen.flatMap((o) => o.categories))),
          firstName: value("firstName"),
          lastName: value("lastName"),
          email: value("email"),
          phone: value("phone"),
          company: value("company"),
          relationship: value("relationship"),
          disclosureText,
          sourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
      setConfirmed(chosen);
      setStatus("success");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      errorRef.current?.focus();
    }
  }

  if (status === "success") {
    const chosenValues = confirmed.map((o) => o.value);
    const variant = confirmation.variants?.find((v) => sameSet(v.whenValues, chosenValues));
    const heading = variant?.heading ?? confirmation.heading;
    const body = variant?.body ?? confirmation.body;
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl border border-border bg-card p-8 outline-none"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <Check className="h-6 w-6 text-accent" strokeWidth={2.2} />
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold">{heading}</h2>
        <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{body}</div>
      </div>
    );
  }

  const busy = status === "loading";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* ── Identity ── */}
      {(fields.name || fields.email || fields.phone || fields.company || fields.relationship) && (
        <fieldset className="space-y-5">
          <legend className="font-display text-lg font-semibold text-foreground">Your information</legend>

          {fields.name && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="firstName" label="First name" required={fields.name === "required"} autoComplete="given-name" />
              <Field id="lastName" label="Last name" required={fields.name === "required"} autoComplete="family-name" />
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {fields.phone && (
              <Field
                id="phone"
                label={channel === "sms" ? "Mobile phone number" : "Phone number"}
                type="tel"
                required={fields.phone === "required"}
                autoComplete="tel"
                placeholder="(480) 555-0100"
                hint={channel === "sms" ? "The mobile number these messages apply to." : undefined}
              />
            )}
            {fields.email && (
              <Field
                id="email"
                label="Email address"
                type="email"
                required={fields.email === "required"}
                autoComplete="email"
                placeholder="you@example.com"
                hint={
                  channel === "sms" && fields.email === "optional"
                    ? "Optional — helps us match your record."
                    : undefined
                }
              />
            )}
          </div>

          {(fields.company || fields.relationship) && (
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.company && <Field id="company" label="Company or organization" autoComplete="organization" />}
              {fields.relationship && (
                <div>
                  <label htmlFor="relationship" className="mb-1.5 block text-sm font-medium text-foreground">
                    Relationship to CMI
                  </label>
                  <select id="relationship" name="relationship" defaultValue="" className={inputClass}>
                    <option value="">Select an option</option>
                    {RELATIONSHIP_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </fieldset>
      )}

      {/* ── Consent choices ── */}
      <fieldset className="space-y-4">
        <legend className="font-display text-lg font-semibold text-foreground">{optionsLegend}</legend>
        {optionsHint && <p className="text-sm leading-7 text-muted-foreground">{optionsHint}</p>}

        <div className="space-y-3">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                htmlFor={`opt-${option.value}`}
                className={`flex cursor-pointer gap-3.5 rounded-xl border p-5 transition ${
                  checked ? "border-accent/60 bg-accent/[0.04]" : "border-border bg-card hover:border-accent/35"
                }`}
              >
                <input
                  type="checkbox"
                  id={`opt-${option.value}`}
                  name={`opt-${option.value}`}
                  checked={checked}
                  onChange={() => toggle(option.value)}
                  className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[var(--accent)]"
                  style={{ height: 18, width: 18 }}
                />
                <span className="text-sm leading-7">
                  <span className="font-semibold text-foreground">{option.title}</span>
                  {option.body && <span className="block text-muted-foreground">{option.body}</span>}
                  {option.fineprint && (
                    <span className="mt-2 block text-xs leading-6 text-muted-foreground">{option.fineprint}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {acknowledgment && <div className="text-sm leading-7 text-muted-foreground">{acknowledgment}</div>}

      <div
        ref={errorRef}
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
        className={error ? "flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive outline-none" : "sr-only"}
      >
        {error && (
          <>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
  autoComplete,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-accent" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-describedby={hintId}
        className={inputClass}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
