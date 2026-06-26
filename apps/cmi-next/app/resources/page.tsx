import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ResourcesClient } from "./resources-client";
import { loadPublishedBlogPosts } from "@/lib/blog/data";

export const metadata = { title: "Resources — Constructed Matter" };
export const revalidate = 60;

function estimateReadTime(content: string): string {
  const words = content?.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length ?? 0;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export default async function ResourcesPage() {
  let posts: ReturnType<typeof buildPost>[] = [];

  try {
    const dbPosts = await loadPublishedBlogPosts();
    posts = dbPosts.map((p, i) => buildPost(p, i));
  } catch {
    // Supabase unavailable — show empty state
  }

  const featured = posts.find((p) => p.featured) ?? posts[0];

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
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

        {posts.length === 0 || !featured ? (
          <div className="mx-auto max-w-7xl px-5 py-24 text-center lg:px-8">
            <p className="text-muted-foreground">No articles published yet. Check back soon.</p>
          </div>
        ) : (
          <ResourcesClient posts={posts} featured={featured} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function buildPost(p: Awaited<ReturnType<typeof loadPublishedBlogPosts>>[number], index: number) {
  return {
    slug:     p.slug ?? p.id,
    title:    p.title,
    excerpt:  p.excerpt ?? "",
    category: p.category ?? "Construction",
    date:     formatDate(p.published_at ?? p.created_at),
    readTime: estimateReadTime(p.content ?? ""),
    image:    p.featured_image ?? "",
    featured: (p as { featured?: boolean }).featured === true || index === 0,
  };
}
