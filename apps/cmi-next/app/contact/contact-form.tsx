"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Select } from "@/components/ui/input";

const HOW_DID_YOU_HEAR = [
  "Google Search",
  "Social Media",
  "Referral",
  "Project Drive-By",
  "Networking Event",
  "Phone Call",
  "Email Inquiry",
  "Walk-In",
  "Vehicle Graphics",
  "Vendor Referral",
];

// Budget ladder, climbing in construction-scale brackets up to $5M, then "Other"
// (which reveals a free-text amount field).
const BUDGET_RANGES = [
  "Under $50,000",
  "$50,000 – $100,000",
  "$100,000 – $250,000",
  "$250,000 – $500,000",
  "$500,000 – $1,000,000",
  "$1,000,000 – $2,000,000",
  "$2,000,000 – $3,000,000",
  "$3,000,000 – $4,000,000",
  "$4,000,000 – $5,000,000",
  "Over $5,000,000",
  "Other",
];

// Where the project stands in the construction process — multi-select chips.
const PROJECT_STATUS_OPTIONS = [
  "Just exploring ideas",
  "Have a design concept",
  "Have construction drawings",
  "Have engineering / structural plans",
  "Permits in progress",
  "Permits approved",
  "Financing secured",
  "Land / lot acquired",
  "Ready to break ground",
  "Selecting a contractor",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

const inputCls =
  "w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-accent focus:ring-1 focus:ring-accent";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [budget, setBudget] = useState("");
  const [projectStatus, setProjectStatus] = useState<string[]>([]);

  function toggleStatus(opt: string) {
    setProjectStatus((prev) =>
      prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
    const data = {
      firstName: val("firstName"),
      lastName: val("lastName"),
      email: val("email"),
      phone: val("phone"),
      source: val("source"),
      subject: val("subject"),
      message: val("message"),
      addressLine1: val("addressLine1"),
      addressLine2: val("addressLine2"),
      city: val("city"),
      state: val("state"),
      zip: val("zip"),
      projectBudget: budget,
      budgetAmount: budget === "Other" ? val("budgetAmount") : "",
      projectStatus,
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
      setBudget("");
      setProjectStatus([]);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-semibold">Message Sent</h2>
        <p className="leading-relaxed text-muted-foreground">
          Thank you for reaching out. A member of our team will be in touch within one business day.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-2 text-sm font-medium text-accent hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name row */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium">
            First Name <span className="text-accent">*</span>
          </label>
          <input id="firstName" name="firstName" type="text" required placeholder="John" className={inputCls} />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium">
            Last Name <span className="text-accent">*</span>
          </label>
          <input id="lastName" name="lastName" type="text" required placeholder="Smith" className={inputCls} />
        </div>
      </div>

      {/* Email + Phone row */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email <span className="text-accent">*</span>
          </label>
          <input id="email" name="email" type="email" required placeholder="john@example.com" className={inputCls} />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" placeholder="(480) 555-0100" className={inputCls} />
        </div>
      </div>

      {/* Address */}
      <fieldset className="space-y-4 rounded-xl border border-border bg-card/40 p-5">
        <legend className="px-1 text-sm font-medium">Project Address</legend>
        <div>
          <label htmlFor="addressLine1" className="mb-1.5 block text-sm font-medium">
            Address Line 1
          </label>
          <input id="addressLine1" name="addressLine1" type="text" placeholder="7314 E Osborn Dr" className={inputCls} />
        </div>
        <div>
          <label htmlFor="addressLine2" className="mb-1.5 block text-sm font-medium">
            Address Line 2
          </label>
          <input id="addressLine2" name="addressLine2" type="text" placeholder="Suite A" className={inputCls} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px_140px]">
          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium">City</label>
            <input id="city" name="city" type="text" placeholder="Scottsdale" className={inputCls} />
          </div>
          <div>
            <label htmlFor="state" className="mb-1.5 block text-sm font-medium">State</label>
            <Select id="state" name="state" className="[&>button]:h-[42px] [&>button]:rounded-lg [&>button]:px-3">
              <option value="">--</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="zip" className="mb-1.5 block text-sm font-medium">Zip Code</label>
            <input id="zip" name="zip" type="text" inputMode="numeric" placeholder="85251" className={inputCls} />
          </div>
        </div>
      </fieldset>

      {/* How did you hear */}
      <div>
        <label htmlFor="source" className="mb-1.5 block text-sm font-medium">
          How did you hear about us?
        </label>
        <Select id="source" name="source" className="[&>button]:h-12 [&>button]:rounded-lg [&>button]:px-4">
          <option value="">Select an option</option>
          {HOW_DID_YOU_HEAR.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      </div>

      {/* Project Budget */}
      <div>
        <label htmlFor="projectBudget" className="mb-1.5 block text-sm font-medium">
          Project Budget Range
        </label>
        <Select
          id="projectBudget"
          name="projectBudget"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="[&>button]:h-12 [&>button]:rounded-lg [&>button]:px-4"
        >
          <option value="">Select a budget range</option>
          {BUDGET_RANGES.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
        {budget === "Other" && (
          <div className="mt-3">
            <label htmlFor="budgetAmount" className="mb-1.5 block text-sm font-medium">
              Budget Amount
            </label>
            <input
              id="budgetAmount"
              name="budgetAmount"
              type="text"
              placeholder="e.g. $7.5M or a specific figure"
              className={inputCls}
            />
          </div>
        )}
      </div>

      {/* Project Status — multi-select chips */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Project Status <span className="font-normal text-muted-foreground">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_STATUS_OPTIONS.map((opt) => {
            const active = projectStatus.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleStatus(opt)}
                aria-pressed={active}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition " +
                  (active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground")
                }
              >
                {active && <Check className="h-3.5 w-3.5" />}
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">
          Project Title / Subject <span className="text-accent">*</span>
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          placeholder="e.g. Custom Home Build — Paradise Valley"
          className={inputCls}
        />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          Message <span className="text-accent">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          placeholder="Tell us about your project — timeline, location, scope, or anything else we should know."
          className={inputCls + " resize-none"}
        />
      </div>

      {/* Privacy */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        By submitting this form you agree to be contacted by Constructed Matter regarding your inquiry. We do not share your information with third parties.
      </p>

      {/* Error */}
      {status === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
          {errorMsg}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
      >
        {status === "loading" ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            Sending…
          </>
        ) : (
          <>
            Send Message <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
