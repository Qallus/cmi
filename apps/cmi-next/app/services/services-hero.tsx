"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ServiceIcon, SERVICES } from "./services-data";

/** Icon draws (900ms + 440ms stagger) → copy flows in at 1400ms → hold → advance. */
const CYCLE_MS = 4600;

export function ServicesHero() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % SERVICES.length), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const service = SERVICES[active];

  return (
    <section
      className="relative overflow-hidden border-b border-border bg-background"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Blueprint grid + accent wash. Both are opacity-tuned so the section
          reads the same in light and dark without swapping assets. */}
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
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ── Copy ── */}
          <div>
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
              construction and design services — planned, permitted, and built by one accountable team.
            </p>

            {/* Live region: the rotating service, spelled out in text. */}
            <div className="mt-10 min-h-[92px] border-l-2 border-accent/35 pl-5" aria-live="polite">
              <div key={`copy-${active}`} className="cmi-flow-in">
                <div className="font-display text-2xl font-semibold leading-snug">{service.title}</div>
                <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{service.tagline}</p>
              </div>
            </div>

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

          {/* ── Animated icon stage ── */}
          <div className="relative">
            {/* No frame and no grid here — the icon sits directly on the hero
                so it reads as part of the section rather than a widget. */}
            <div className="relative mx-auto flex aspect-square w-full max-w-[440px] items-center justify-center">
              {/* key remounts the node so the stroke animation replays each cycle */}
              <ServiceIcon
                key={`icon-${active}`}
                service={service}
                draw
                strokeWidth={0.32}
                className="relative h-[62%] w-[62%] text-accent"
              />
              <span
                key={`index-${active}`}
                className="cmi-fade-in absolute bottom-6 right-7 font-mono text-xs tracking-widest text-muted-foreground"
              >
                {String(active + 1).padStart(2, "0")} / {String(SERVICES.length).padStart(2, "0")}
              </span>
            </div>

            {/* Selector pips — also the accessible control for the rotation. */}
            <div className="mx-auto mt-7 flex max-w-[440px] flex-wrap justify-center gap-2">
              {SERVICES.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show ${item.title}`}
                  aria-current={index === active}
                  className={
                    index === active
                      ? "h-1.5 w-9 rounded-full bg-accent transition-all"
                      : "h-1.5 w-4 rounded-full bg-border transition-all hover:bg-accent/50"
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
