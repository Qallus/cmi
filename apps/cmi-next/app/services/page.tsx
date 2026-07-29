import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ServicesHero } from "./services-hero";
import { ServiceIcon, SERVICES } from "./services-data";

export const metadata = {
  title: "Our Services — Constructed Matter",
  description:
    "Custom homes, boutique commercial, ADUs, renovations, design coordination, new construction, and pools and landscaping — delivered by one accountable Arizona team.",
};

const PROCESS = [
  { step: "01", title: "Consultation", body: "We meet to understand your vision, goals, and budget — no obligation, just a conversation." },
  { step: "02", title: "Design & Planning", body: "Our team develops detailed plans, selects materials, and handles permitting so you don't have to." },
  { step: "03", title: "Build", body: "Expert construction with regular updates, on-site quality checks, and transparent communication." },
  { step: "04", title: "Handoff", body: "Final walkthrough, punch list completion, and a thorough handoff — we don't leave until it's right." },
];

const ASSURANCES = [
  { title: "Licensed, bonded & insured", body: "AZ ROC licensed general contractor, KB1 - 343120, with full liability coverage on every job." },
  { title: "One accountable team", body: "A single project manager owns your build from first walkthrough to final punch list." },
  { title: "Transparent budgets", body: "Line-item estimates and real-time cost tracking, so there are no surprises at the end." },
  { title: "Greater Phoenix Metro", body: "Based in Scottsdale and building across the Valley, from Arcadia to Paradise Valley." },
];

export default function ServicesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <ServicesHero />

        {/* ── All services ── */}
        <section id="all-services" className="scroll-mt-24 bg-background py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Our Capabilities</div>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Services Built on Expertise</h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">
                Every service below is delivered in-house or through trades we have worked with for years,
                keeping scope, schedule, and quality under one point of accountability.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Not linked: the individual service pages stay live but are held
                  back from the site until their content has been reviewed.
                  New Construction is intentionally omitted from this grid. */}
              {SERVICES.filter((service) => service.key !== "new-construction").map((service) => (
                <article
                  key={service.key}
                  className="flex flex-col rounded-2xl border border-border bg-card p-7"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background">
                    <ServiceIcon service={service} className="h-5 w-5 text-accent" strokeWidth={1.4} />
                  </div>
                  <h3 className="mt-6 font-display text-xl font-semibold leading-snug">{service.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{service.body}</p>
                  <ul className="mt-5 space-y-2">
                    {service.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.4} />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Assurances ── */}
        <section className="border-y border-border bg-card/40 py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Why CMI</div>
                <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight">
                  The same standard on every scope
                </h2>
                <p className="mt-5 text-base leading-8 text-muted-foreground">
                  Whether it is a casita, a tenant improvement, or a full ground-up build, the process, the
                  reporting, and the finish standard do not change.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {ASSURANCES.map((item) => (
                  <div key={item.title} className="rounded-xl border border-border bg-background p-6">
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Process ── */}
        <section className="bg-background py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-14 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">How We Work</div>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Our Process</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS.map((p) => (
                <div key={p.step} className="rounded-2xl border border-border bg-card p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
                    <span className="font-display text-sm font-semibold text-accent">{p.step}</span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-[#111111] py-20 text-center text-white lg:py-24">
          <div className="mx-auto max-w-2xl px-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Ready to Get Started?</div>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Let&apos;s Build Something Great</h2>
            <p className="mt-5 text-base leading-8 text-white/70">
              Tell us about your project and we&apos;ll get you in front of the right team.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-4 text-sm font-semibold text-white transition hover:bg-accent/90">
                Let&apos;s Build Together <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/portfolio" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                View Our Work
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
