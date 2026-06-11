import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

interface Feature {
  title: string;
  body: string;
  icon: React.ReactNode;
}

interface OtherService {
  title: string;
  subtitle: string;
  href: string;
}

interface ServicePageProps {
  category: string;
  headline: string;
  subheadline: string;
  heroImage: string;
  stats: { value: string; label: string }[];
  description: string[];
  ctaEstimate?: string;
  features: Feature[];
  ctaHeadline: string;
  ctaBody: string;
  ctaBg: string;
  otherServices: OtherService[];
}

export function ServicePageLayout({
  category,
  headline,
  subheadline,
  heroImage,
  stats,
  description,
  ctaEstimate = "Request a free estimate",
  features,
  ctaHeadline,
  ctaBody,
  ctaBg,
  otherServices,
}: ServicePageProps) {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Breadcrumb */}
        <div className="border-b border-border bg-background">
          <div className="mx-auto max-w-7xl px-5 py-3 lg:px-8">
            <nav className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href="/" className="transition hover:text-accent">Home</Link>
              <span>/</span>
              <Link href="/services" className="transition hover:text-accent">Services</Link>
              <span>/</span>
              <span className="text-foreground">{category}</span>
            </nav>
          </div>
        </div>

        {/* Hero */}
        <section className="relative h-[480px] overflow-hidden">
          <img src={heroImage} alt={category} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
          <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-5 lg:px-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-accent">{category}</p>
            <h1 className="mb-4 max-w-xl font-display text-4xl font-semibold leading-tight text-white md:text-5xl"
              dangerouslySetInnerHTML={{ __html: headline }} />
            <p className="mb-8 max-w-md text-base leading-relaxed text-white/75">{subheadline}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                Start Your Project <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/60">
                Talk to Us
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <div className="bg-black">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-4 py-6" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
              {stats.map((s) => (
                <div key={s.label} className="px-6 text-center">
                  <div className="font-display text-3xl font-semibold text-accent">{s.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-white/50">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <section className="bg-background py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid items-start gap-16 lg:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">What We Do</div>
                <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl"
                  dangerouslySetInnerHTML={{ __html: description[0] }} />
                {description.slice(1).map((p, i) => (
                  <p key={i} className="mt-5 leading-relaxed text-muted-foreground">{p}</p>
                ))}
                <Link href="/contact" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline underline-offset-4">
                  {ctaEstimate} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {features.map((f) => (
                  <div key={f.title} className="rounded-xl border border-border bg-card p-5">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                      <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        {f.icon}
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden py-24 text-center text-white">
          <img src={ctaBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-accent">Ready to Build?</p>
            <h2 className="mb-6 font-display text-3xl font-semibold tracking-tight md:text-4xl">{ctaHeadline}</h2>
            <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-white/70">{ctaBody}</p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-4 text-sm font-semibold text-white transition hover:bg-accent/90">
                Get a Free Estimate <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-8 py-4 text-sm font-semibold text-white transition hover:border-white/60">
                Contact Us
              </Link>
            </div>
          </div>
        </section>

        {/* Other Services */}
        <section className="border-t border-border bg-card/40 py-16">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <h3 className="mb-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Explore More Services</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {otherServices.map((s) => (
                <Link key={s.href} href={s.href} className="group rounded-xl border border-border p-4 transition hover:border-accent/50">
                  <div className="text-xs font-semibold text-foreground transition group-hover:text-accent">{s.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.subtitle}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
