import Link from "next/link";
import {
  ArrowRight,
  Brain,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  ChevronRight,
  ClipboardList,
  Construction,
  DraftingCompass,
  Home,
  MonitorCog,
  Package,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { HomeFeaturedProjects } from "./home-featured-projects";
import { HeroCarousel } from "./home-hero";
import { HomeVideoBackground } from "./home-video-background";

export const metadata = { title: "Constructed Matter — Building What Matters Most" };

const HERO_IMAGES = [
  "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/VW-Garage-1-scaled.jpg",
  "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/1_LorschKit3.jpg",
  "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/Trinity-Church-Office-4.jpg",
];

const SERVICES = [
  {
    title: "Custom Homes & Casitas",
    body: "Custom homes, guest houses, and casitas designed around your lifestyle and built with enduring materials.",
    href: "/services/residential",
    icon: "🏠",
  },
  {
    title: "Boutique Commercial",
    body: "Functional, modern commercial spaces that elevate your brand and support the way your team works.",
    href: "/services/commercial",
    icon: "🏢",
  },
  {
    title: "ADU",
    body: "Accessory dwelling units that maximize your property's potential with turnkey permitting and design.",
    href: "/services/adu",
    icon: "🏡",
  },
  {
    title: "Renovations & Additions",
    body: "Thoughtful updates, expansions, and additions planned around the structure, schedule, and daily life of the space.",
    href: "/services/renovations-additions",
    icon: "🔨",
  },
  {
    title: "Architectural & Design Coordination",
    body: "Coordinated plans, selections, and construction details that keep the design intent aligned from concept through build.",
    href: "/services/architectural-design",
    icon: "📐",
  },
  {
    title: "New Construction",
    body: "Ground-up builds from foundation to finish, handled through every phase with uncompromising standards.",
    href: "/services/new-construction",
    icon: "🏗️",
  },
];

const SERVICE_CARDS = [
  {
    title: "Custom Homes and Casitas",
    body: "Custom homes, guest houses, and casitas designed around your lifestyle and built with enduring materials.",
    href: "/services/residential",
    icon: Home,
  },
  {
    title: "Boutique Commercial",
    body: "Functional, modern commercial spaces that elevate your brand and support the way your team works.",
    href: "/services/commercial",
    icon: Building2,
  },
  {
    title: "ADU",
    body: "Accessory dwelling units that maximize your property's potential with turnkey permitting and design.",
    href: "/services/adu",
    icon: BriefcaseBusiness,
  },
  {
    title: "Renovations and Additions",
    body: "Thoughtful updates, expansions, and additions planned around the structure, schedule, and daily life of the space.",
    href: "/services/renovations-additions",
    icon: ClipboardList,
  },
  {
    title: "Architectural and Design Coordination",
    body: "Coordinated plans, selections, and construction details that keep the design intent aligned from concept through build.",
    href: "/services/architectural-design",
    icon: DraftingCompass,
  },
  {
    title: "New Construction",
    body: "Ground-up builds from foundation to finish, handled through every phase with uncompromising standards.",
    href: "/services/new-construction",
    icon: Building2,
  },
];

const FEATURED_PROJECTS = [
  {
    title: "Ambassador ADU",
    category: "ADU",
    location: "Arcadia / Scottsdale",
    year: "2024",
    body: "Full kitchen, private bath, custom interior detailing.",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/f8d1c98a-e6b7-4b1d-ab9e-3ce111e9b817/Kit+Detail+2.jpg",
    href: "/portfolio/ambassador-adu",
  },
  {
    title: "Conrad Interior",
    category: "Design Coordination",
    location: "Scottsdale",
    year: "2024",
    body: "Warm material palette, custom millwork, layered lighting.",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/a5134c71-2845-460c-98cc-a897b612b5d5/Conrad+Residence-13.jpg",
    href: "/portfolio/conrad-interior",
  },
  {
    title: "Ply Place",
    category: "Residential",
    location: "Scottsdale",
    year: "2024",
    body: "Complex custom residential, clean finishes, refined detailing.",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1738363725187-C9L2JWZOXXQT2M517PCG/Keim-10.jpg",
    href: "/portfolio/ply-place",
  },
  {
    title: "Garden Plaza",
    category: "Commercial",
    location: "Scottsdale",
    year: "2023",
    body: "Tenant improvement, MEP coordination, interior build-out.",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1712244593060-S7HC61T66LQH3IRBMVR9/Trinity+Church-14.jpg",
    href: "/portfolio/garden-plaza",
  },
  {
    title: "Parco",
    category: "Residential",
    location: "Scottsdale",
    year: "2023",
    body: "High-end custom home, precision materials and finishes.",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/c1b7f55a-c05b-415d-9dd4-8bdffe9f2949/Parco+Residence-12.jpg",
    href: "/portfolio/parco",
  },
  {
    title: "Res. Inn",
    category: "Commercial",
    location: "Scottsdale",
    year: "2024",
    body: "12,000 sq ft · 6-month timeline.",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1712241900212-YJ82KS4IKVY52B3LLIZJ/Hotel-2.jpg",
    href: "/portfolio/res-inn",
  },
];

const PROCESS_STEPS = [
  {
    number: "01",
    title: "Consultation",
    body: "We listen to your ideas, goals, and concerns, taking time to understand your vision and what you hope to achieve.",
    icon: Brain,
  },
  {
    number: "02",
    title: "Assessment",
    body: "We review the plan, verify feasibility, and complete a high-level budget to set clear expectations from the start.",
    icon: ClipboardCheck,
  },
  {
    number: "03",
    title: "Design and Planning",
    body: "Our architects, designers, and project managers craft a detailed scope, realistic budget, and schedule.",
    icon: MonitorCog,
  },
  {
    number: "04",
    title: "Assemble",
    body: "We engage trusted trades, align procurement, and prepare the details needed to set the build in motion.",
    icon: Package,
  },
  {
    number: "05",
    title: "Construction",
    body: "Our team transforms your vision into reality with clear communication at every step through handoff.",
    icon: Construction,
  },
];

const REVIEWS = [
  {
    name: "Bryan McMichael",
    label: "Office Build-Out Client",
    initials: "BM",
    color: "#1a73e8",
    quote:
      "Constructed Matter did an amazing job on our office build-out. Everything from start to finish was smooth, professional, and well-organized. Joe and Brandon were great to work with, super responsive, and clearly take pride in their craft. The finished space looks fantastic, and we couldn't be happier.",
  },
  {
    name: "John",
    label: "Local Guide - Homeowner",
    initials: "J",
    color: "#34a853",
    quote:
      "We couldn't be more excited with the transformation our home has taken. The interior and exterior upgrades have given our old home a new life. The attention to detail is unmatched. We wish we did it sooner.",
  },
  {
    name: "berlitz",
    label: "Verified Google Reviewer",
    initials: "B",
    color: "#ea4335",
    quote:
      "Brandon and Joe know their business inside and out from planning to execution, they bring both expertise and professionalism to the table. Working with them has been a smooth and great experience from start to finish. Highly recommend them for their services.",
  },
];

export default function HomePage() {
  return (
    <div className="home-color-test">
      <SiteHeader />
      <main>
        {/* ── Hero ────────────────────────────────────────────── */}
        <section className="relative flex min-h-[calc(100vh-72px)] items-end overflow-hidden bg-black">
          <HeroCarousel images={HERO_IMAGES} />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.6) 36%, rgba(0,0,0,0.28) 100%), linear-gradient(0deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.22) 42%, rgba(0,0,0,0.38) 100%)",
            }}
          />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 lg:px-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-accent">Arizona's Premier Builder</div>
            <h1 className="mt-3 font-display text-5xl font-semibold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl">
              Building What<br />Matters Most
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75">
              From concept to completion, we craft residential and commercial spaces that stand the test of time. Rooted in craftsmanship, driven by vision.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/portfolio" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                View Our Work <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                Let's Build Together <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Services ────────────────────────────────────────── */}
        <section className="border-b border-border bg-background py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">What We Do</div>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Services Built on Expertise</h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICE_CARDS.map((s) => (
                <Link key={s.href} href={s.href} className="group rounded-xl border border-border bg-card p-6 transition hover:border-accent/40 hover:shadow-md">
                  <s.icon className="mb-8 h-6 w-6 text-accent" strokeWidth={1.5} />
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-accent">
                    Learn More <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Featured Projects ────────────────────────────────── */}
        <HomeFeaturedProjects projects={FEATURED_PROJECTS} />
        <section className="hidden">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Selected Work</div>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Featured Projects</h2>
              </div>
              <Link href="/portfolio" className="hidden items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:flex">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="mt-10 flex gap-5 overflow-x-auto px-5 pb-4 lg:px-8">
            {FEATURED_PROJECTS.map((p) => (
              <Link key={p.href} href={p.href} className="group relative h-[440px] w-[320px] shrink-0 overflow-hidden rounded-xl bg-muted">
                <img src={p.image} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{p.category} · {p.location}</div>
                  <h3 className="mt-2 font-display text-xl font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-white/70">{p.body}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                    <span>{p.year}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 px-5 sm:hidden lg:px-8">
            <Link href="/portfolio" className="text-sm font-medium text-accent hover:underline">View all projects →</Link>
          </div>
        </section>

        {/* ── About / Stats ────────────────────────────────────── */}
        <section className="border-b border-border bg-background py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="relative">
                <img
                  src="https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/03/Brandon_Joe.png"
                  alt="Brandon Fadden and Joseph Ballard — Managing Partners"
                  className="w-full rounded-2xl object-cover"
                />
                <div className="absolute -bottom-4 -right-4 rounded-xl border border-border bg-card px-5 py-4 shadow-lg">
                  <div className="font-display text-3xl font-semibold text-accent">40+</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Years Combined<br />Construction Experience</div>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Who We Are</div>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">A Full-Service Construction & Design Firm Rooted in Arizona</h2>
                <p className="mt-6 leading-7 text-muted-foreground">
                  Constructed Matter Inc. was founded on a simple belief: every project is a partnership. Whether you're building your dream home, expanding your business, or investing in your property, you deserve a team that listens, communicates openly, and delivers without compromise.
                </p>
                <p className="mt-4 leading-7 text-muted-foreground">
                  From our base in Scottsdale, Arizona, we serve the entire Greater Phoenix Metro Area with residential construction, commercial build-outs, ADU development, interior design, and comprehensive project management.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/team" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold transition hover:border-accent hover:text-accent">
                    Meet the Team
                  </Link>
                  <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90">
                    Contact Us <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section className="bg-[#111111] py-24 text-white lg:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Our Project Process</div>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-white lg:text-6xl">The Process</h2>
            </div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {PROCESS_STEPS.map((step) => (
                <div key={step.number} className="group relative min-h-[220px] overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-accent/45 hover:bg-accent/10">
                  <div className="text-[11px] font-semibold tracking-[0.16em] text-white/20 transition group-hover:text-accent/70">{step.number}</div>
                  <div className="flex min-h-[160px] flex-col items-center justify-center gap-5 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] transition group-hover:border-accent/45">
                      <step.icon className="h-7 w-7 text-white/75" strokeWidth={1.4} />
                    </div>
                    <h3 className="font-display text-lg font-semibold leading-snug text-white">{step.title}</h3>
                    <p className="max-h-0 overflow-hidden text-sm leading-6 text-white/70 opacity-0 transition-all duration-300 group-hover:max-h-32 group-hover:opacity-100">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-16 max-w-3xl text-center font-display text-2xl font-semibold leading-snug text-white lg:mt-20 lg:text-3xl">
              Building spaces that endure, inspire, and reflect the people who live and work in them.
            </p>
          </div>
        </section>

        <section className="border-b border-border bg-background py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-14 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Google Reviews</div>
                <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight lg:text-5xl">What Our Clients Say</h2>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex gap-0.5" aria-label="5 star rating">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-sm font-semibold">5.0</span>
                  <span className="text-sm text-muted-foreground">- 15+ Google Reviews</span>
                </div>
              </div>
              <a href="https://www.google.com/search?q=Constructed+Matter+reviews" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent">
                All Reviews <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {REVIEWS.map((review) => (
                <article key={review.name} className="flex min-h-[280px] flex-col rounded-xl border border-border bg-card p-8">
                  <div className="mb-5 flex gap-0.5" aria-label="5 star rating">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="flex-1 text-sm leading-7 text-muted-foreground">{review.quote}</p>
                  <div className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: review.color }}>
                      {review.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{review.name}</div>
                      <div className="text-xs text-muted-foreground">{review.label}</div>
                    </div>
                    <div className="ml-auto text-lg font-semibold text-[#4285f4]">G</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-24 text-center text-white lg:py-32">
          <div className="absolute inset-0 overflow-hidden">
            <HomeVideoBackground />
          </div>
          <div className="absolute inset-0 bg-black/78" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/45 to-black/80" />
          <div className="relative z-10 mx-auto max-w-2xl px-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Start Your Project</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">Ready to Build Something Extraordinary?</h2>
            <p className="mt-5 text-base leading-7 text-white/75">
              Whether you have blueprints in hand or just an idea on a napkin, we are here to help. Let's talk about your next project.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                Let's Build Together <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/book" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                Book Appointment
              </Link>
            </div>
          </div>
        </section>

        <section className="hidden">
          <div className="absolute inset-0 opacity-30">
            <img src="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1631045711643-QRD679F10OVP2EKT9SM0/Trinity+Church+Office-4+edit.jpg?format=1500w" alt="" className="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80" />
          <div className="relative z-10 mx-auto max-w-2xl px-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Work With Us</div>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Ready to Start Your Next Project?</h2>
            <p className="mt-5 text-base leading-7 text-white/75">
              Join the hundreds of Arizona homeowners and business owners who have trusted Constructed Matter to bring their vision to life.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                Let's Build Together <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/team" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                Meet the Team
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
