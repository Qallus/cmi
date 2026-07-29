import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Static services hero — headline, intro, and CTAs. */
export function ServicesHero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      {/* Static blueprint grid + accent wash. Opacity-tuned so the section reads
          the same in light and dark without swapping assets. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-25 blur-3xl dark:opacity-20"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)" }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            What We Do
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight lg:text-6xl">
            Everything we build,
            <span className="block text-accent">under one roof.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground">
            From groundbreaking to grand opening, Constructed Matter delivers a complete suite of
            construction and design services, planned, permitted, and built by one accountable team.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#all-services"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              See All Services <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent"
            >
              Let&apos;s Build Together
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
