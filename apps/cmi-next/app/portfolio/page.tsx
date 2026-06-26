import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PortfolioPublicClient } from "./portfolio-public-client";
import { loadPortfolioItems } from "@/lib/portfolio/data";
import { demoPortfolioItems } from "@/lib/portfolio/demo-data";

export const metadata = { title: "Portfolio — Constructed Matter" };

export default async function PortfolioArchivePage() {
  let items = demoPortfolioItems;
  try {
    items = await loadPortfolioItems({ publishedOnly: true });
  } catch {
    // fall through to demo data
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section className="border-b border-border bg-card/40 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">Our Work</div>
                <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">Portfolio</h1>
                <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                  Featured work from across Arizona, including custom homes, casitas, boutique commercial spaces, renovations, additions, and architectural coordination.
                </p>
              </div>
            </div>
          </div>
        </section>

        <PortfolioPublicClient items={items} />
      </main>
      <SiteFooter />
    </>
  );
}
