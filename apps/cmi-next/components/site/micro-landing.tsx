"use client";

import * as React from "react";
import { ArrowRight, Check, Moon, Sun, X } from "lucide-react";
import { LandingLeadForm } from "./landing-lead-form";

// The main CMI site these campaign domains funnel into.
const CMI = "https://constructedmatter.com";

export type MicroLandingContent = {
  /** Wordmark shown in the top bar. */
  brand: string;
  /** Lead source tag stored on the contact (which domain sent the lead). */
  source: string;
  /** Bare domain, used in the footer. */
  domain: string;
  theme: "dark" | "light";
  heroImage: string;
  eyebrow: string;
  headline: string;
  /** Second headline line, rendered in the accent color. */
  headlineTwist?: string;
  sub: string;
  primaryCta: string;
  /** Optional "the problem" list (great for the ConstructionSucks angle). */
  painTitle?: string;
  pains?: string[];
  pitchTitle: string;
  pitchBody: string;
  bullets: { title: string; body: string }[];
  formTitle: string;
  formSub: string;
  formCta: string;
};

// Deep links into the main CMI site so visitors can convert either way.
const EXPLORE = [
  { label: "See Our Work", href: `${CMI}/portfolio` },
  { label: "Our Services", href: `${CMI}/services` },
  { label: "About Constructed Matter", href: `${CMI}/about` },
];

export function MicroLanding({ content }: { content: MicroLandingContent }) {
  const [dark, setDark] = React.useState(content.theme === "dark");
  const page = dark ? "bg-black text-white" : "bg-[#faf7f2] text-neutral-900";
  const muted = dark ? "text-white/70" : "text-neutral-600";
  const cardBorder = dark ? "border-white/10" : "border-black/10";

  return (
    <div className={page}>
      {/* ── Minimal top bar (its own micro-brand, not the CMI nav) ── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
        <a href={CMI} className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight transition hover:opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dark ? "/brand/cmi-favicon-white.png" : "/brand/cmi-favicon-black.png"} alt="Constructed Matter, Inc." className="h-6 w-6 object-contain" />
          {content.brand}
        </a>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className={`grid h-8 w-8 place-items-center rounded-full border transition ${dark ? "border-white/20 text-white/70 hover:border-white/40 hover:text-white" : "border-black/15 text-neutral-500 hover:border-black/30 hover:text-neutral-900"}`}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <a href={CMI} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            Visit Constructed Matter <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <img src={content.heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className={`absolute inset-0 ${dark ? "bg-black/75" : "bg-black/55"}`} />
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-28 text-white lg:px-8 lg:py-40">
          <div className="max-w-3xl">
            <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">{content.eyebrow}</div>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
              {content.headline}
              {content.headlineTwist && (<><br /><span className="text-accent">{content.headlineTwist}</span></>)}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">{content.sub}</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <a href="#start" className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-4 text-sm font-semibold text-white transition hover:bg-accent/90">
                {content.primaryCta} <ArrowRight className="h-4 w-4" />
              </a>
              <a href={CMI} className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                Explore the Full Site
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── The problem (optional) ── */}
      {content.pains && content.pains.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-28">
          {content.painTitle && (
            <h2 className="max-w-2xl font-display text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">{content.painTitle}</h2>
          )}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {content.pains.map((p) => (
              <div key={p} className={`flex items-start gap-3 rounded-xl border ${cardBorder} p-5`}>
                <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <span className="text-sm leading-relaxed">{p}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The pitch + value props ── */}
      <section className={`border-y ${cardBorder} ${dark ? "bg-white/[0.03]" : "bg-white"}`}>
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="max-w-2xl">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Why Constructed Matter</div>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">{content.pitchTitle}</h2>
            <p className={`mt-5 text-lg leading-relaxed ${muted}`}>{content.pitchBody}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {content.bullets.map((b) => (
              <div key={b.title} className={`rounded-2xl border ${cardBorder} ${dark ? "bg-black" : "bg-[#faf7f2]"} p-7`}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
                  <Check className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-display text-xl font-semibold">{b.title}</h3>
                <p className={`mt-2.5 text-sm leading-relaxed ${muted}`}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lead form (on-page capture → CMI dashboard) ── */}
      <section id="start" className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:gap-20 lg:px-8 lg:py-28">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Get Started</div>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">{content.formTitle}</h2>
            <p className={`mt-5 text-lg leading-relaxed ${muted}`}>{content.formSub}</p>
            <div className="mt-8 space-y-3">
              {EXPLORE.map((e) => (
                <a key={e.href} href={e.href} className="group flex items-center gap-2 text-sm font-medium hover:text-accent">
                  <ArrowRight className="h-4 w-4 text-accent transition group-hover:translate-x-0.5" /> {e.label}
                </a>
              ))}
            </div>
          </div>
          <LandingLeadForm source={content.source} cta={content.formCta} />
        </div>
      </section>

      {/* ── Minimal footer ── */}
      <footer className={`border-t ${cardBorder}`}>
        <div className={`mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm lg:flex-row lg:items-center lg:justify-between lg:px-8 ${muted}`}>
          <a href={CMI} className="hover:text-accent">Powered by Constructed Matter, Inc.</a>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={`${CMI}/contact`} className="hover:text-accent">Contact</a>
            <a href={`${CMI}/privacy-policy`} className="hover:text-accent">Privacy</a>
            <a href={`${CMI}/terms-of-service`} className="hover:text-accent">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
