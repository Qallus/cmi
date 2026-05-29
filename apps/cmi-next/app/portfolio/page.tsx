import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadPortfolioItems } from "@/lib/portfolio/data";
import { demoPortfolioItems } from "@/lib/portfolio/demo-data";

export default async function PortfolioArchivePage() {
  let items = demoPortfolioItems;
  let configured = false;
  try {
    items = await loadPortfolioItems({ publishedOnly: true });
    configured = true;
  } catch {
    configured = false;
  }

  const categories = ["All Projects", ...Array.from(new Set(items.map(item => item.category || "Uncategorized")))];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <img src="/brand/cmi-logo-light.png" alt="Constructed Matter, Inc." className="h-10 w-auto dark:hidden" />
            <img src="/brand/cmi-logo-dark.png" alt="Constructed Matter, Inc." className="hidden h-10 w-auto dark:block" />
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/portfolio" className="text-accent">Portfolio</Link>
            <Link href="/book">Book</Link>
            <Link href="/dashboard/project-manager">Dashboard</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Our Work</div>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Featured work from across Arizona, including custom homes, casitas, commercial spaces, renovations, additions, and architectural coordination.
          </p>
          {!configured ? <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-muted-foreground">Showing demo portfolio records until Supabase portfolio fields are configured.</p> : null}
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-6 py-5">
          {categories.map(category => (
            <span key={category} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground first:border-accent first:text-accent">{category}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 text-sm text-muted-foreground">Showing all {items.length} projects</div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <Link key={item.id} href={`/portfolio/${item.slug || item.id}`} className="group relative min-h-[440px] overflow-hidden rounded-lg bg-muted">
              {item.featured_image ? <img src={item.featured_image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{item.category || "Portfolio"} · {item.location || "Arizona"}</div>
                <h2 className="mt-2 font-display text-2xl font-semibold">{item.title}</h2>
                <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
                  <span>{item.year || "Featured"}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
