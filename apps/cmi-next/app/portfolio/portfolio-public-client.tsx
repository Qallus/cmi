"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PortfolioItem {
  id: string;
  title: string;
  slug?: string | null;
  category?: string | null;
  location?: string | null;
  year?: number | string | null;
  featured_image?: string | null;
  description?: string | null;
}

const FILTERS = ["All Projects", "Residential", "Commercial", "ADU", "New Construction", "Renovations and Additions", "Design Coordination"];

export function PortfolioPublicClient({ items }: { items: PortfolioItem[] }) {
  const [active, setActive] = useState("All Projects");

  const filtered = active === "All Projects"
    ? items
    : items.filter((item) => item.category === active);

  return (
    <>
      {/* Filter bar */}
      <div className="sticky top-[72px] z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex items-center gap-3 overflow-x-auto py-4">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActive(f)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-medium transition whitespace-nowrap ${
                  active === f
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-accent/50 hover:text-accent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result count */}
      <div className="mx-auto max-w-7xl px-5 pt-8 lg:px-8">
        <p className="text-sm text-muted-foreground">Showing {filtered.length} project{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/portfolio/${item.slug || item.id}`}
              className="group relative min-h-[440px] overflow-hidden rounded-2xl bg-muted transition hover:-translate-y-1"
            >
              {item.featured_image ? (
                <img
                  src={item.featured_image}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] group-hover:brightness-50"
                />
              ) : (
                <div className="absolute inset-0 bg-muted" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  {item.category || "Portfolio"} · {item.location || "Arizona"}
                </div>
                <h2 className="mt-2 font-display text-2xl font-semibold">{item.title}</h2>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-white/70">{item.description}</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
                  <span>{item.year || "Featured"}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            No projects found in this category.
          </div>
        )}
      </section>
    </>
  );
}
