import Link from "next/link";
import {
  ArrowRight,
  Bath,
  BedDouble,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  DoorOpen,
  DraftingCompass,
  Home,
  LampDesk,
  PanelsTopLeft,
  Trees,
} from "lucide-react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export type LandingFeature = {
  title: string;
  body: string;
  icon: keyof typeof iconMap;
};

export type LandingColumn = {
  title: string;
  items: string[];
};

export type LandingPageContent = {
  eyebrow: string;
  title: string;
  accent?: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  secondaryHref: string;
  heroImage: string;
  painTitle: string;
  painBody: string;
  painPoints: string[];
  valueTitle: string;
  valueBody: string;
  features: LandingFeature[];
  highlightTitle: string;
  highlightBody: string;
  highlightItems: string[];
  columnsTitle: string;
  columnsBody: string;
  columns: LandingColumn[];
  whyTitle: string;
  whyBody: string;
  whyPoints: string[];
  processTitle: string;
  processSteps: string[];
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
};

const iconMap = {
  bath: Bath,
  bed: BedDouble,
  briefcase: BriefcaseBusiness,
  building: Building2,
  door: DoorOpen,
  drafting: DraftingCompass,
  home: Home,
  office: LampDesk,
  panels: PanelsTopLeft,
  trees: Trees,
};

export function LandingPage({ content }: { content: LandingPageContent }) {
  return (
    <>
      <SiteHeader />
      <main className="bg-background text-foreground">
        <section className="relative min-h-[680px] overflow-hidden">
          <img src={content.heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.66)_42%,rgba(0,0,0,0.24)_100%),linear-gradient(0deg,rgba(0,0,0,0.52)_0%,rgba(0,0,0,0.18)_55%,rgba(0,0,0,0.38)_100%)]" />
          <div className="relative z-10 mx-auto flex min-h-[680px] max-w-7xl flex-col justify-center px-5 py-24 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">{content.eyebrow}</p>
              <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.98] tracking-tight text-white md:text-7xl">
                {content.title}
                {content.accent ? <span className="block text-accent">{content.accent}</span> : null}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/82 md:text-lg">{content.subtitle}</p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link href="/book" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                  {content.primaryCta} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={content.secondaryHref} className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:border-white/70 hover:bg-white/15">
                  {content.secondaryCta}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-card/40 py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">The Opportunity</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">{content.painTitle}</h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">{content.painBody}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {content.painPoints.map(point => (
                <div key={point} className="flex items-start gap-3 rounded-lg bg-background p-4 shadow-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span className="text-sm leading-6 text-muted-foreground">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="options" className="py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">What We Build</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">{content.valueTitle}</h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">{content.valueBody}</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {content.features.map(feature => {
                const Icon = iconMap[feature.icon];
                return (
                  <article key={feature.title} className="rounded-xl bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                    <Icon className="h-5 w-5 text-accent" strokeWidth={1.7} />
                    <h3 className="mt-5 font-display text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#111111] py-16 text-white lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Planning Possibilities</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">{content.highlightTitle}</h2>
              <p className="mt-5 text-base leading-8 text-white/70">{content.highlightBody}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {content.highlightItems.map(item => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/78">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Design Direction</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">{content.columnsTitle}</h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">{content.columnsBody}</p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {content.columns.map(column => (
                <div key={column.title} className="rounded-xl bg-card p-7 shadow-sm">
                  <h3 className="font-display text-2xl font-semibold">{column.title}</h3>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {column.items.map(item => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-card/40 py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Why CMI</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">{content.whyTitle}</h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">{content.whyBody}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {content.whyPoints.map(point => (
                <div key={point} className="rounded-lg bg-background p-4 text-sm font-medium text-foreground shadow-sm">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Our Process</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">{content.processTitle}</h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {content.processSteps.map((step, index) => (
                <div key={step} className="rounded-xl bg-card p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{String(index + 1).padStart(2, "0")}</div>
                  <h3 className="mt-8 font-display text-xl font-semibold">{step}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#111111] py-20 text-white">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
          <div className="relative mx-auto max-w-4xl px-5 text-center lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Start Your Project</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">{content.ctaTitle}</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/72">{content.ctaBody}</p>
            <Link href="/book" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
              {content.ctaButton} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

