import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ResourcesClient } from "./resources-client";

export const metadata = { title: "Resources — Constructed Matter" };

export const POSTS = [
  {
    slug: "custom-home-build",
    title: "What to Expect During a Custom Home Build",
    excerpt: "From breaking ground to final walkthrough, an honest, phase-by-phase breakdown of what the custom home construction process looks like when done right. No surprises, no sugarcoating.",
    category: "Construction",
    date: "March 10, 2026",
    readTime: "6 min read",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/123aab5a-5d9c-4da3-ade7-0c00a8ae39ea/Brandons+House-1.jpg",
    featured: true,
  },
  {
    slug: "adu-101",
    title: "ADU 101: What You Need to Know Before Building",
    excerpt: "Thinking about adding an accessory dwelling unit to your property? Here's what Arizona homeowners need to know before breaking ground.",
    category: "ADU",
    date: "Feb 28, 2026",
    readTime: "5 min read",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/f8d1c98a-e6b7-4b1d-ab9e-3ce111e9b817/Kit+Detail+2.jpg",
    featured: false,
  },
  {
    slug: "interior-design-trends-2026",
    title: "Architectural and Design Coordination Trends Shaping Arizona Homes in 2026",
    excerpt: "Natural materials, warm neutrals, and intentional restraint. A look at what's defining the best interiors in Scottsdale and the Valley this year.",
    category: "Architectural and Design Coordination",
    date: "Feb 14, 2026",
    readTime: "4 min read",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/a5134c71-2845-460c-98cc-a897b612b5d5/Conrad+Residence-13.jpg",
    featured: false,
  },
  {
    slug: "commercial-construction-process",
    title: "Commercial Construction: How CMI Manages Large-Scale Projects",
    excerpt: "Trade coordination, tight schedules, and zero room for error. Inside the process CMI uses to deliver commercial builds on time and on budget.",
    category: "Commercial",
    date: "Jan 30, 2026",
    readTime: "5 min read",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1e81aab0-672a-40ef-8ee4-324172b85e8b/Trinity+Church-14.jpg",
    featured: false,
  },
  {
    slug: "renovation-checklist",
    title: "The Renovation Checklist: From Concept to Completion",
    excerpt: "The questions you should be asking, the decisions you'll need to make, and the milestones to watch — before your renovation begins.",
    category: "Residential",
    date: "Jan 15, 2026",
    readTime: "4 min read",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1738363725187-C9L2JWZOXXQT2M517PCG/Keim-10.jpg",
    featured: false,
  },
  {
    slug: "choosing-a-general-contractor",
    title: "How to Choose the Right General Contractor for Your Project",
    excerpt: "License, portfolio, communication, and culture. The five things that actually matter when you're vetting a general contractor in Arizona.",
    category: "Construction",
    date: "Jan 5, 2026",
    readTime: "5 min read",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/Peffer-Pitt+Residence-1.jpg",
    featured: false,
  },
  {
    slug: "spotlight-ambassador-adu",
    title: "Project Spotlight: How CMI Built and Delivered the Drake Residence",
    excerpt: "A behind-the-scenes look at one of our largest ground-up residential builds, from site prep to final walkthrough, and everything in between.",
    category: "Project Spotlight",
    date: "Dec 20, 2025",
    readTime: "6 min read",
    image: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/DJI_0414.JPG",
    featured: false,
  },
];

export default function ResourcesPage() {
  const featured = POSTS.find((p) => p.featured)!;

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="border-b border-border bg-card/40 py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Knowledge &amp; Insights</div>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">Resources</h1>
            <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
              Expert insight on construction, design, and the decisions that shape great spaces — written by the team that builds them.
            </p>
          </div>
        </section>

        <ResourcesClient posts={POSTS} featured={featured} />
      </main>
      <SiteFooter />
    </>
  );
}
