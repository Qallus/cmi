"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, MapPin, X } from "lucide-react";

type FeaturedProject = {
  title: string;
  category: string;
  location: string;
  year: string;
  body: string;
  image: string;
  href: string;
};

export function HomeFeaturedProjects({ projects }: { projects: FeaturedProject[] }) {
  const [selected, setSelected] = React.useState<FeaturedProject | null>(null);

  React.useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  return (
    <>
      <section
        className="border-b border-border bg-card/40 py-20"
        style={{
          // Kept intentionally faint so the grid reads as texture, not structure,
          // in both light and dark.
          backgroundImage:
            "linear-gradient(color-mix(in oklch, var(--border) 20%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--border) 20%, transparent) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Selected Work</div>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">Featured Projects</h2>
            </div>
            <Link href="/portfolio" className="hidden items-center gap-1 text-sm font-medium text-accent transition hover:text-accent/80 sm:flex">
              View full portfolio <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div
          className="mt-10 overflow-x-auto pb-7 [scrollbar-color:var(--accent)_transparent] [scrollbar-width:thin]"
          style={{ marginLeft: "max(1.25rem, calc((100vw - 80rem) / 2 + 2rem))" }}
        >
          <div className="flex gap-5 pr-0">
            {projects.map((project) => (
              <button
                key={project.href}
                type="button"
                onClick={() => setSelected(project)}
                className="group relative h-[440px] w-[320px] shrink-0 overflow-hidden rounded-xl bg-muted text-left outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring md:w-[360px]"
              >
                <img src={project.image} alt={project.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.82) 18%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.12) 66%, rgba(0,0,0,0) 88%)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">{[project.category, project.location].filter(Boolean).join(" · ")}</div>
                  <h3 className="mt-1.5 font-display text-2xl font-semibold">{project.title}</h3>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-2 max-w-7xl px-5 lg:px-8">
          <Link href="/portfolio" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent/80 sm:hidden">
            View full portfolio <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${selected.title} project details`}>
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close project details" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
              aria-label="Close project details"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative h-72 overflow-hidden">
              <img src={selected.image} alt={selected.title} className="h-full w-full object-cover" />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.48) 42%, rgba(0,0,0,0) 82%)",
                }}
              />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">{selected.category}</div>
                <h3 className="mt-2 font-display text-3xl font-semibold">{selected.title}</h3>
              </div>
            </div>
            <div className="space-y-5 p-6">
              <p className="text-sm leading-7 text-muted-foreground">{selected.body}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Location</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-accent" />{selected.location}</div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Year</div>
                  <div className="mt-2 text-sm font-semibold">{selected.year}</div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Project Type</div>
                  <div className="mt-2 text-sm font-semibold">{selected.category}</div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={selected.href} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                  View Complete Project <ExternalLink className="h-4 w-4" />
                </Link>
                <Link href="/contact" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent">
                  Start Your Project <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
