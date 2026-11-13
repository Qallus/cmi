"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Hammer, Home, Package } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Turnstile } from "@/components/site/turnstile";

// Each visitor picks a path first (trade partner brief §4), so vendor pitches
// and trade partner applications stop landing in the client lead inbox.
type Path = "client" | "vendor_pitch" | "trade_partner";
const PATHS: { key: Path; title: string; body: string; icon: typeof Home; panel: string; panelBody: string }[] = [
  { key: "client", title: "I'm looking to build or remodel", body: "A new home, addition, casita or remodel.", icon: Home,
    panel: "Tell us about your project", panelBody: "A few details help us match you with the right person. Only the starred fields are required." },
  { key: "trade_partner", title: "I'm a trade partner looking to work with you", body: "Subcontractors, suppliers and consultants.", icon: Hammer,
    panel: "Become a trade partner", panelBody: "" },
  { key: "vendor_pitch", title: "I have a product or service to present", body: "Materials, products, software and services.", icon: Package,
    panel: "Tell us what you offer", panelBody: "Share your product or service and we'll pass it to the right person on our team." },
];

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

export function ContactForm({ turnstileSiteKey, tradePartnersOn = true }: { turnstileSiteKey?: string | null; tradePartnersOn?: boolean }) {
  // The most common reason is open by default; a ?path= link picks another.
  const [path, setPath] = useState<Path>("client");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setTurnstileToken(t), []);
  // When the form was opened: a bot submits faster than a person can type.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
    const p = new URLSearchParams(window.location.search).get("path");
    // eslint-disable-next-line -- one-time deep-link read on mount
    if (p === "client" || p === "vendor_pitch" || p === "trade_partner") setPath(p);
  }, []);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [source, setSource] = useState("");
  const [addrState, setAddrState] = useState("");
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
      path,
      company: val("company"),
      company_website: val("company_website"),
      startedAt: startedAt.current,
      turnstileToken,
      firstName: val("firstName"),
      lastName: val("lastName"),
      email: val("email"),
      phone: val("phone"),
      source,
      subject: val("subject"),
      message: val("message"),
      addressLine1: val("addressLine1"),
      addressLine2: val("addressLine2"),
      city: val("city"),
      state: addrState,
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
      setSource("");
      setAddrState("");
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

  const pitch = path === "vendor_pitch";
  const current = PATHS.find((p) => p.key === path) ?? PATHS[0];
  const Icon = current.icon;
  return (
    <div id="contact-form" className="scroll-mt-28 space-y-5">
      {/* Step 1: three clear choices, one always selected. */}
      <fieldset>
        <legend className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-display text-xl font-semibold text-foreground sm:text-2xl">How can we help?</span>
          <span className="text-muted-foreground">Choose one of 3 options. The form below changes to match.</span>
        </legend>
        <div role="radiogroup" aria-label="How can we help?" className="mt-4 grid gap-3 sm:grid-cols-3">
          {PATHS.map((p, i) => {
            const on = path === p.key;
            return (
              <button
                key={p.key} type="button" role="radio" aria-checked={on} onClick={() => setPath(p.key)}
                className={"group relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 pr-10 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
                  (on ? "border-accent bg-accent/10 shadow-md" : "border-border bg-card hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-md")}
              >
                {/* Radio dot: reads as "pick one" at a glance. */}
                <span aria-hidden="true" className={"absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full border-2 transition " + (on ? "border-accent bg-accent text-white" : "border-muted-foreground/40 bg-background group-hover:border-accent/70")}>
                  {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className={"grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold " + (on ? "bg-accent text-white" : "bg-muted text-muted-foreground")}>{i + 1}</span>
                  <p.icon className={"h-5 w-5 " + (on ? "text-accent" : "text-muted-foreground")} strokeWidth={1.6} />
                </span>
                <span className="text-sm font-semibold leading-snug">{p.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{p.body}</span>
                <span className={"mt-auto pt-1 text-xs font-semibold " + (on ? "text-accent" : "text-muted-foreground group-hover:text-accent")}>{on ? "Selected ↓" : "Choose this →"}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Step 2: the form for the chosen option, in its own panel so it reads as a form. */}
      <div className="rounded-2xl border-2 border-accent/40 bg-card p-5 shadow-sm sm:p-8">
        <div className="mb-6 flex items-start gap-3 border-b border-border pb-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"><Icon className="h-5 w-5" strokeWidth={1.7} /></span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{current.title}</div>
            <h2 className="mt-0.5 font-display text-2xl font-semibold leading-tight">{current.panel}</h2>
            {current.panelBody ? <p className="mt-1 text-sm text-muted-foreground">{current.panelBody}</p> : null}
          </div>
        </div>
      {path === "trade_partner" && (
        <div>
          {tradePartnersOn ? (
            <>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                Trade partners apply through our online pre-qualification application. You&apos;ll tell us about your
                company and trades, upload your W-9 and insurance, and sign our Master Subcontractor Agreement in one place.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/prequalification" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                  Start the application <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/become-a-trade-partner" className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold transition hover:bg-muted">
                  What to expect
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Email <a className="text-accent hover:underline" href="mailto:info@constructedmatter.com">info@constructedmatter.com</a> with your
              company, trades and service area, and we&apos;ll send you our pre-qualification application.
            </p>
          )}
        </div>
      )}

      {(path === "client" || pitch) && (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bots fill every field; people never see this one. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_website">Company website</label>
        <input id="company_website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

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

      {pitch && (
        <div>
          <label htmlFor="company" className="mb-1.5 block text-sm font-medium">Company</label>
          <input id="company" name="company" type="text" placeholder="Your company" className={inputCls} />
        </div>
      )}

      {!pitch && (<>
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
            <Select id="state" name="state" value={addrState} onChange={(e) => setAddrState(e.target.value)} className="[&>button]:h-[42px] [&>button]:rounded-lg [&>button]:px-3">
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
        <Select id="source" name="source" value={source} onChange={(e) => setSource(e.target.value)} className="[&>button]:h-12 [&>button]:rounded-lg [&>button]:px-4">
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

      </>)}

      {/* Subject */}
      <div>
        <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">
          {pitch ? "Product or service" : "Project Title / Subject"} <span className="text-accent">*</span>
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          placeholder={pitch ? "e.g. Engineered stone countertops" : "e.g. Custom Home Build — Paradise Valley"}
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
          placeholder={pitch ? "Tell us what you offer and why it's a fit for our projects." : "Tell us about your project — timeline, location, scope, or anything else we should know."}
          className={inputCls + " resize-none"}
        />
      </div>

      {/* Privacy */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        By submitting this form you agree to be contacted by Constructed Matter regarding your inquiry. We do not share your information with third parties.
      </p>

      <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />

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
      )}
      </div>
    </div>
  );
}
