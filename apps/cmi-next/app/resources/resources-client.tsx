"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  featured: boolean;
}

const FILTERS = ["All", "Construction", "Architectural and Design Coordination", "ADU", "Residential", "Commercial", "Project Spotlight"];

export function ResourcesClient({ posts, featured }: { posts: Post[]; featured: Post }) {
  const [active, setActive] = useState("All");

  const grid = posts
    .filter((p) => !p.featured)
    .filter((p) => active === "All" || p.category === active);

  const showFeatured = active === "All" || featured.category === active;

  return (
    <>
      {/* Filter bar */}
      <div className="sticky top-[72px] z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex items-center gap-3 overflow-x-auto py-4">
            <span className="mr-2 shrink-0 text-xs font-medium text-muted-foreground">{posts.length} articles</span>
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

      {/* Featured post */}
      {showFeatured && (
        <section className="bg-background pb-4 pt-12">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <Link href={`/resources/${featured.slug}`} className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:border-accent/40">
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
                <div className="aspect-video overflow-hidden lg:aspect-auto lg:min-h-[460px]">
                  <img
                    src={featured.image}
                    alt={featured.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex flex-col justify-center p-8 lg:p-12">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="rounded-full bg-accent/10 px-3 py-0.5 text-[11px] font-semibold text-accent">{featured.category}</span>
                    <span className="text-xs text-muted-foreground">{featured.date}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{featured.readTime}</span>
                  </div>
                  <h2 className="font-display text-2xl font-semibold leading-snug transition group-hover:text-accent lg:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{featured.excerpt}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-accent transition-all group-hover:gap-3">
                    Read Article <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="bg-background py-8 pb-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          {grid.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {grid.map((post) => (
                <Link key={post.slug} href={`/resources/${post.slug}`} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-accent/40">
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-6">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="rounded-full bg-accent/10 px-3 py-0.5 text-[11px] font-semibold text-accent">{post.category}</span>
                      <span className="text-xs text-muted-foreground">{post.date}</span>
                    </div>
                    <h3 className="font-display text-xl font-semibold leading-snug transition group-hover:text-accent">{post.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent">
                      Read Article <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <p className="font-display text-2xl text-muted-foreground">No articles found</p>
              <p className="mt-2 text-sm text-muted-foreground">Try a different category.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
