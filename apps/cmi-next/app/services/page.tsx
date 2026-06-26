import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = { title: "Our Services — Constructed Matter" };

const SERVICES = [
  {
    title: "Residential",
    body: "Custom homes built around your lifestyle, precision craftsmanship, quality materials, and designs that endure.",
    href: "/services/residential",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1738363725187-C9L2JWZOXXQT2M517PCG/Keim-10.jpg?format=1500w",
    icon: <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1z" />,
  },
  {
    title: "Commercial",
    body: "Retail, office, and tenant improvement projects built to your brand standards and business requirements.",
    href: "/services/commercial",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1712241900212-YJ82KS4IKVY52B3LLIZJ/Hotel-2.jpg?format=1500w",
    icon: <path d="M3 21h18M3 7v14m6-14v14m6-14v14m6-14v14M3 7l9-4 9 4" />,
  },
  {
    title: "ADU",
    body: "Accessory dwelling units that unlock value from your property, including permitting, design, and turnkey builds.",
    href: "/services/adu",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/c1b7f55a-c05b-415d-9dd4-8bdffe9f2949/Parco+Residence-12.jpg?format=1500w",
    icon: <><rect x="3" y="8" width="18" height="13" rx="1" /><path d="M7 8V5a2 2 0 012-2h6a2 2 0 012 2v3" /></>,
  },
  {
    title: "Renovations and Additions",
    body: "Full-service oversight from permits to punch list. We keep your project on time, on budget, and on vision.",
    href: "/services/renovations-additions",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/ca1f785c-2a89-43ad-a9a9-43e5d964e576/VW+Garage-4.jpg?format=1500w",
    icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6m-3 7h3m-6 4h6" />,
  },
  {
    title: "Architectural and Design Coordination",
    body: "Curated material selections, spatial planning, and finish coordination that make every room feel intentional.",
    href: "/services/architectural-design",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/7fac9d01-d6fb-4bd6-bcdf-aa1feb69aa7f/Schott+Residence-2.jpg?format=1500w",
    icon: <path d="M4 20h16M4 20V10l4-6h8l4 6v10M9 20v-4a3 3 0 016 0v4" />,
  },
  {
    title: "New Construction",
    body: "Ground-up builds managed from foundation to final walkthrough — single-family, multi-family, and commercial.",
    href: "/services/new-construction",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/2dc42c14-bea2-4bcb-b8bd-d24b7b9cf1e7/Duff+Residence-2.jpg?format=1500w",
    icon: <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h2m4 0h2m-6 4h2m4 0h2" />,
  },
];

const PROCESS = [
  { step: "01", title: "Consultation", body: "We meet to understand your vision, goals, and budget — no obligation, just a conversation." },
  { step: "02", title: "Design & Planning", body: "Our team develops detailed plans, selects materials, and handles permitting so you don't have to." },
  { step: "03", title: "Build", body: "Expert construction with regular updates, on-site quality checks, and transparent communication." },
  { step: "04", title: "Handoff", body: "Final walkthrough, punch list completion, and a thorough handoff — we don't leave until it's right." },
];

export default function ServicesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        {/* ── Hero ── */}
        <section className="border-b border-border bg-card/40 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">What We Do</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">Our Services</h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                From groundbreaking to grand opening, we offer a comprehensive suite of construction and design services, all delivered with the precision and care that Constructed Matter is known for.
              </p>
            </div>
          </div>
        </section>

        {/* ── Services Grid ── */}
        <section className="bg-background py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((s) => (
                <Link key={s.href} href={s.href} className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="aspect-video overflow-hidden">
                    <img src={s.image} alt={s.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        {s.icon}
                      </svg>
                    </div>
                    <h2 className="font-display text-xl font-semibold">{s.title}</h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-all group-hover:gap-3">
                      Learn More <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Process ── */}
        <section className="border-y border-border bg-card/40 py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-14 text-center">
              <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">How We Work</div>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Our Process</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS.map((p) => (
                <div key={p.step} className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                    <span className="font-display text-lg font-semibold text-accent">{p.step}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-black py-20 text-center text-white">
          <div className="mx-auto max-w-2xl px-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">Ready to Get Started?</div>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Let&apos;s Build Something Great</h2>
            <p className="mt-5 text-base leading-relaxed text-white/70">
              Tell us about your project and we&apos;ll schedule a free consultation with the right team.
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
