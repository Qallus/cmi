// Catalog of public frontend pages that can be reviewed in the Live Page Editor.
// These are same-origin Next.js routes in this app, so they load safely in an
// iframe and allow same-origin DOM inspection.

export type PreviewPage = {
  slug: string;   // stable identifier used for sessions/refs
  title: string;  // human label
  path: string;   // same-origin route to load in the iframe
};

export const PREVIEW_PAGES: PreviewPage[] = [
  { slug: "home", title: "Home", path: "/" },
  { slug: "about", title: "About", path: "/about" },
  { slug: "services", title: "Services", path: "/services" },
  { slug: "portfolio", title: "Portfolio", path: "/portfolio" },
  { slug: "team", title: "Team", path: "/team" },
  { slug: "contact", title: "Contact", path: "/contact" },
  { slug: "resources", title: "Resources", path: "/resources" },
  { slug: "blog", title: "Blog", path: "/blog" },
  { slug: "adu-casita", title: "ADU / Casita (Landing)", path: "/adu-casita" },
  { slug: "improve-your-home", title: "Improve Your Home (Landing)", path: "/improve-your-home" },
];

export function getPreviewPage(slug: string): PreviewPage | undefined {
  return PREVIEW_PAGES.find((p) => p.slug === slug);
}
