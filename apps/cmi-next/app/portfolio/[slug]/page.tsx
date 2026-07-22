import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { loadPortfolioItemBySlug } from "@/lib/portfolio/data";
import { demoPortfolioItems } from "@/lib/portfolio/demo-data";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PortfolioGallery } from "./portfolio-detail-client";

export default async function PortfolioDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let item = demoPortfolioItems.find(row => row.slug === slug);

  try {
    item = await loadPortfolioItemBySlug(slug);
  } catch {
    if (!item) notFound();
  }

  if (!item) notFound();

  const gallery = Array.from(new Set([item.featured_image, ...(item.gallery_images || [])].filter(Boolean))) as string[];
  const hero = item.featured_image || gallery[0];
  const attributes = item.attributes_json || [];

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground">
      <section className="relative min-h-[72vh] overflow-hidden bg-black text-white">
        {hero ? <img src={hero} alt={item.title} className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/10" />
        <div className="relative mx-auto flex min-h-[72vh] max-w-7xl items-end px-6 pb-16">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Portfolio / {item.subtitle || item.category || "Constructed Matter"} {item.location ? `- ${item.location}` : ""}</div>
            <h1 className="mt-4 font-display text-6xl font-semibold tracking-tight">{item.title}</h1>
            {item.year ? <p className="mt-4 text-lg text-white/80">{item.year}</p> : null}
          </div>
        </div>
      </section>

      <PortfolioGallery images={gallery} title={item.title} />

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1fr_340px]">
        <article>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Project Overview</div>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">About This Project</h2>
          <div className="mt-8 max-w-4xl whitespace-pre-line text-base leading-8 text-muted-foreground">
            {item.description || "Project details are being prepared."}
          </div>

          {(item.services_used || []).length ? (
            <div className="mt-12 border-t border-border pt-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scope of Work</div>
              <div className="mt-5 flex flex-wrap gap-2">
                {item.services_used?.map(service => <span key={service} className="rounded-full bg-muted px-3 py-1 text-sm">{service}</span>)}
              </div>
            </div>
          ) : null}
        </article>

        <aside className="h-fit rounded-lg border border-border bg-card p-7">
          <DetailField label="Category" value={item.category} />
          <DetailField label="Location" value={item.location} />
          <DetailField label="Year Completed" value={item.year ? String(item.year) : null} />
          <DetailField label="Timeline" value={item.timeline} />
          <DetailField label="Square Footage" value={item.square_feet ? `${item.square_feet.toLocaleString()} sq ft` : null} />
          {attributes.map(attribute => <DetailField key={`${attribute.label}-${attribute.value}`} label={attribute.label} value={attribute.value} />)}
          <div className="mt-7 border-t border-border pt-6">
            <Link href="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground">
              Start Your Project
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </section>
      </main>
      <SiteFooter />
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="mb-7">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}
