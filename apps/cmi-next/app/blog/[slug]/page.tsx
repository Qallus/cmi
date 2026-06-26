import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { loadPublishedBlogPostBySlug } from "@/lib/blog/data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  try {
    const post = await loadPublishedBlogPostBySlug(slug);
    if (!post) return { title: "Blog Post | Constructed Matter" };
    return {
      title: `${post.title} | Constructed Matter`,
      description: post.excerpt || "Construction insight from the Constructed Matter team.",
    };
  } catch {
    return { title: "Blog Post | Constructed Matter" };
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  let post = null;
  try {
    post = await loadPublishedBlogPostBySlug(slug);
  } catch {
    post = null;
  }

  if (!post) notFound();

  const date = formatDate(post.published_at || post.created_at);

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <article>
          <section className="bg-card/35 py-12 lg:py-16">
            <div className="mx-auto max-w-4xl px-5 lg:px-8">
              <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-accent">
                <ArrowLeft className="h-4 w-4" />
                Back to blog
              </Link>
              <div className="mt-8 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{post.category || "CMI Blog"}</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">{post.title}</h1>
              {post.excerpt ? <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p> : null}
              <div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {date ? (
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-accent" strokeWidth={1.6} />
                    {date}
                  </span>
                ) : null}
                {post.author ? <span>{post.author}</span> : null}
              </div>
            </div>
          </section>

          {post.featured_image ? (
            <section className="py-8">
              <div className="mx-auto max-w-6xl px-5 lg:px-8">
                <div className="aspect-[16/9] overflow-hidden rounded-xl bg-muted">
                  <img src={post.featured_image} alt={post.title} className="h-full w-full object-cover" />
                </div>
              </div>
            </section>
          ) : null}

          <section className="pb-16 pt-6 lg:pb-24">
            <div className="mx-auto max-w-3xl px-5 lg:px-8">
              {post.tags?.length ? (
                <div className="mb-8 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div
                className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-display prose-a:text-accent"
                dangerouslySetInnerHTML={{ __html: post.content || "<p>No content has been added for this post yet.</p>" }}
              />
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
