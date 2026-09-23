import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";
import { ApplicationClient } from "./application-client";

export const metadata = {
  title: "Become a Trade Partner — Constructed Matter",
  description:
    "Apply to work with Constructed Matter. Tell us about your trade, service area, capacity, licensing and insurance, and we'll be in touch about upcoming projects.",
};

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Tell us about your company", body: "Your trade, where you work, the size of project that suits you, and how you price." },
  { title: "Send your paperwork", body: "W-9, certificate of insurance, and your licence if you hold one. We verify before sending work." },
  { title: "Meet the team", body: "For most trades we'll set up a short call or site walk to go through scope and scheduling." },
  { title: "Get on the bid list", body: "Approved partners are matched to projects by trade, service area and capacity." },
];

const READY = [
  "Your licence number and expiry",
  "Certificate of Insurance",
  "A completed W-9",
  "Two or three references",
];

export default async function PrequalificationPage() {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section className="border-b border-border bg-card/40 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">Trade Partners</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">
                Build With<br /><span className="text-accent">Constructed Matter</span>
              </h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                We work with subcontractors, vendors, designers and consultants across the Valley on residential
                remodels, additions, casitas and custom homes. Tell us what you do and where you do it, and
                we&apos;ll match you to the work that fits.
              </p>
            </div>
          </div>
        </section>

        {/* Application + Sidebar */}
        <section className="bg-background py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid items-start gap-16 lg:grid-cols-[1fr_420px] lg:gap-20">
              <ApplicationClient />

              {/* Sticks in view while the form scrolls (desktop only) */}
              <div className="space-y-8 lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-2xl border border-border bg-card p-8">
                  <h3 className="mb-6 font-display text-xl font-semibold">How it works</h3>
                  <ol className="space-y-5">
                    {STEPS.map((s, i) => (
                      <li key={s.title} className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                          {i + 1}
                        </span>
                        <div>
                          <p className="mb-0.5 text-sm font-medium text-foreground">{s.title}</p>
                          <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-2xl border border-border bg-card p-8">
                  <h3 className="mb-4 font-display text-xl font-semibold">Have these to hand</h3>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {READY.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Only your name, email and phone are needed to send the form. Anything you don&apos;t have today
                    can follow — your answers save as you go.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-8">
                  <h3 className="mb-6 font-display text-xl font-semibold">Questions?</h3>
                  <ul className="space-y-5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="mb-0.5 font-medium text-foreground">Phone</p>
                        <a href="tel:+14806284458" className="transition hover:text-accent">(480) 628-4458</a>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="mb-0.5 font-medium text-foreground">Email</p>
                        <a href="mailto:info@constructedmatter.com" className="transition hover:text-accent">info@constructedmatter.com</a>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <circle cx="12" cy="11" r="3" />
                      </svg>
                      <div>
                        <p className="mb-0.5 font-medium text-foreground">7314 E Osborn Dr Suite A</p>
                        <p>Scottsdale, AZ 85251</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-border p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Licensed, Bonded &amp; Insured</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">ROC License KB1 - 343120</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
