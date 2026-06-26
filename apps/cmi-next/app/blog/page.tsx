import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { blogPostSlug, loadPublishedBlogPosts } from "@/lib/blog/data";
import type { BlogPost } from "@/lib/blog/types";

export const metadata = {
  title: "Blog | Constructed Matter",
  description: "Construction, design, and project planning insights from Constructed Matter.",
};

function formatDate(value: string | null) {
  if (!value) return "Coming soon";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

function getExcerpt(post: BlogPost) {
  if (post.excerpt) return post.excerpt;
  if (!post.content) return "Construction insight from the Constructed Matter team.";
  return post.content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
}

export default async function BlogArchivePage() {
  let posts: BlogPost[] = [];
  try {
    posts = await loadPublishedBlogPosts();
  } catch {
    posts = [];
  }

  const featured = posts[0];
  const remaining = posts.slice(1);

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="bg-card/35 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">CMI Blog</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">Construction Notes</h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Field-tested insight on Arizona construction, remodeling, ADUs, design coordination, and project planning.
              </p>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            {featured ? (
              <div className="space-y-12">
                <Link
                  href={`/blog/${blogPostSlug(featured)}`}
                  className="group grid overflow-hidden rounded-xl border border-border bg-card transition hover:border-accent/45 lg:grid-cols-[1.05fr_0.95fr]"
                >
                  <div className="relative min-h-[320px] bg-muted lg:min-h-[420px]">
                    {featured.featured_image ? <img src={featured.featured_image} alt={featured.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" /> : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                  </div>
                  <div className="flex flex-col justify-center p-7 lg:p-10">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{featured.category || "Featured"}</div>
                    <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">{featured.title}</h2>
                    <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">{getExcerpt(featured)}</p>
                    <div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-accent" strokeWidth={1.6} />
                        {formatDate(featured.published_at || featured.created_at)}
                      </span>
                      {featured.author ? <span>{featured.author}</span> : null}
                    </div>
                    <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                      Read article <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>

                {remaining.length ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {remaining.map((post) => (
                      <BlogCard key={post.id} post={post} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-10 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Blog</div>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">No Published Posts Yet</h2>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                  Published dashboard posts will appear here automatically once they are saved with a public blog slug.
                </p>
                <Link href="/resources" className="mt-7 inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent">
                  View resources <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${blogPostSlug(post)}`} className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-accent/45">
      <div className="relative aspect-[4/3] bg-muted">
        {post.featured_image ? <img src={post.featured_image} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
      </div>
      <div className="p-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">{post.category || "CMI"}</div>
        <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight">{post.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{getExcerpt(post)}</p>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{formatDate(post.published_at || post.created_at)}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-accent">
            Read <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}
