// Landing pages created in the dashboard or by Claude (site_pages). Live pages
// show their published copy; ?preview=<token> shows the draft, unindexed.
// The hand-built pages beside this route (/lp/design-build-enjoy…) win over it.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MicroLanding } from "@/components/site/micro-landing";
import { loadForRoute } from "@/lib/site-pages/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const page = await loadForRoute(slug, preview);
  if (!page) return { title: "Page not found — Constructed Matter" };
  const { title, description } = page.content;
  return {
    title, description,
    alternates: { canonical: `https://constructedmatter.com/lp/${slug}` },
    openGraph: { title, description, url: `https://constructedmatter.com/lp/${slug}`, type: "website", images: page.content.landing.heroImage ? [page.content.landing.heroImage] : undefined },
    robots: page.preview ? { index: false, follow: false } : undefined,
  };
}

export default async function SitePage({ params, searchParams }: Props) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const page = await loadForRoute(slug, preview);
  if (!page) notFound();
  return (
    <>
      {page.preview && (
        <div className="sticky top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-black">
          Preview of an unpublished draft — only people with this link can see it.
        </div>
      )}
      <MicroLanding content={page.content.landing} />
    </>
  );
}
