import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Calendar } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { POSTS } from "../page";
import { getArticleContent } from "./article-content";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  return { title: `${post.title} — Constructed Matter` };
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const content = getArticleContent(slug);
  const related = POSTS.filter((p) => p.slug !== slug && p.category === post.category).slice(0, 2);
  const others = POSTS.filter((p) => p.slug !== slug && p.category !== post.category).slice(0, 2 - related.length);
  const relatedPosts = [...related, ...others].slice(0, 3);

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <div className="relative min-h-[52vh] overflow-hidden bg-black">
          <img
            src={post.image}
            alt={post.title}
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/10" />
          <div className="relative mx-auto flex min-h-[52vh] max-w-7xl flex-col justify-end px-5 pb-14 lg:px-8">
            {/* Breadcrumb */}
            <div className="mb-5 flex items-center gap-2 text-[11px] font-medium text-white/60">
              <Link href="/resources" className="hover:text-white transition">Resources</Link>
              <span>/</span>
              <span className="text-white/80">{post.category}</span>
            </div>
            <span className="mb-4 inline-flex w-fit rounded-full bg-accent/20 px-3 py-0.5 text-[11px] font-semibold text-accent">
              {post.category}
            </span>
            <h1 className="max-w-3xl font-display text-4xl font-semibold leading-snug tracking-tight text-white lg:text-5xl">
              {post.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-[13px] text-white/70">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {post.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {post.readTime}
              </span>
            </div>
          </div>
        </div>

        {/* Article body */}
        <section className="bg-background py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-16 lg:grid-cols-[1fr_300px]">
              <article>
                {/* Excerpt / lede */}
                <p className="mb-10 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>

                {content ? (
                  <div className="space-y-8">
                    {content.sections.map((section, i) => (
                      <div key={i}>
                        {section.heading && (
                          <h2 className="mb-3 font-display text-2xl font-semibold tracking-tight">
                            {section.heading}
                          </h2>
                        )}
                        <p className="leading-8 text-muted-foreground">{section.body}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Full article coming soon.</p>
                )}

                {/* Back link */}
                <div className="mt-14 border-t border-border pt-8">
                  <Link
                    href="/resources"
                    className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Resources
                  </Link>
                </div>
              </article>

              {/* Sidebar */}
              <aside className="space-y-8">
                {/* CTA */}
                <div className="rounded-2xl bg-accent p-7 text-white">
                  <h3 className="mb-2 font-display text-lg font-semibold">Ready to Build?</h3>
                  <p className="mb-5 text-sm leading-relaxed text-white/80">
                    Talk to our team about your project — we typically respond within one business day.
                  </p>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-accent transition hover:opacity-90"
                  >
                    Get in Touch <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Related posts */}
                {relatedPosts.length > 0 && (
                  <div>
                    <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      More Articles
                    </div>
                    <div className="space-y-4">
                      {relatedPosts.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/resources/${p.slug}`}
                          className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-accent/40"
                        >
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                            <img
                              src={p.image}
                              alt={p.title}
                              className="h-full w-full object-cover transition group-hover:scale-105"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-accent">
                              {p.category}
                            </span>
                            <p className="text-sm font-medium leading-snug group-hover:text-accent transition line-clamp-2">
                              {p.title}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
