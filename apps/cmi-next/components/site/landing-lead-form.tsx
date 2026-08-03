"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

const field =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-accent focus:ring-1 focus:ring-accent";

// Compact lead form for the campaign landing pages. Posts to the shared
// /api/contact endpoint so leads land in the CMI dashboard (contact +
// submission), tagged with `source` so we know which domain brought them in.
export function LandingLeadForm({
  source,
  cta = "Request My Free Consultation",
}: {
  source: string;
  cta?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const form = e.currentTarget;
    const val = (n: string) =>
      (form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";

    const message = val("message").trim();
    const data = {
      firstName: val("firstName"),
      lastName: val("lastName"),
      email: val("email"),
      phone: val("phone"),
      source,
      subject: `${source} — Landing Inquiry`,
      message: message || `New lead from ${source}.`,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Something went wrong. Please try again.");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-8 text-foreground shadow-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <Check className="h-6 w-6 text-accent" />
        </div>
        <h3 className="font-display text-2xl font-semibold">You&apos;re all set.</h3>
        <p className="leading-relaxed text-muted-foreground">
          Thanks for reaching out — a member of the Constructed Matter team will be in touch within one business day.
        </p>
        <button onClick={() => setStatus("idle")} className="mt-1 text-sm font-medium text-accent hover:underline">
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium">First Name <span className="text-accent">*</span></label>
          <input id="firstName" name="firstName" type="text" required placeholder="John" className={field} />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium">Last Name <span className="text-accent">*</span></label>
          <input id="lastName" name="lastName" type="text" required placeholder="Smith" className={field} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email <span className="text-accent">*</span></label>
          <input id="email" name="email" type="email" required placeholder="john@example.com" className={field} />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">Phone</label>
          <input id="phone" name="phone" type="tel" placeholder="(480) 555-0100" className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">Tell us about your project</label>
        <textarea id="message" name="message" rows={4} placeholder="Timeline, location, scope, or anything else we should know." className={`${field} resize-none`} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        By submitting, you agree to be contacted by Constructed Matter about your inquiry. We never share your information.
      </p>
      {status === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
      >
        {status === "loading" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : (<>{cta} <ArrowRight className="h-4 w-4" /></>)}
      </button>
    </form>
  );
}
