// Catalog of public frontend pages that can be reviewed in the Live Page Editor.
// Labels mirror the public site navigation (components/site/site-header.tsx) so
// the page selector reads the same as the live nav. These are same-origin
// Next.js routes in this app, so they load safely in an iframe and allow
// same-origin DOM inspection.

export type PreviewPage = {
  slug: string;   // stable identifier used for sessions/refs
  title: string;  // human label (matches site nav)
  path: string;   // same-origin route to load in the iframe
  group?: string; // optional grouping in the selector (e.g. "Services")
};

export const PREVIEW_PAGES: PreviewPage[] = [
  { slug: "home", title: "Home", path: "/" },
  { slug: "about", title: "About Us", path: "/about" },
  { slug: "team", title: "Our Team", path: "/team" },
  { slug: "portfolio", title: "Portfolio", path: "/portfolio" },
  { slug: "resources", title: "Resources", path: "/resources" },
  { slug: "blog", title: "Blog", path: "/blog" },
  { slug: "contact", title: "Contact", path: "/contact" },

  { slug: "services", title: "Services — All", path: "/services", group: "Services" },
  { slug: "services-residential", title: "Residential", path: "/services/residential", group: "Services" },
  { slug: "services-commercial", title: "Commercial", path: "/services/commercial", group: "Services" },
  { slug: "services-adu", title: "ADU", path: "/services/adu", group: "Services" },
  { slug: "services-renovations-additions", title: "Renovations and Additions", path: "/services/renovations-additions", group: "Services" },
  { slug: "services-architectural-design", title: "Architectural and Design Coordination", path: "/services/architectural-design", group: "Services" },
  { slug: "services-new-construction", title: "New Construction", path: "/services/new-construction", group: "Services" },
];

export function getPreviewPage(slug: string): PreviewPage | undefined {
  return PREVIEW_PAGES.find((p) => p.slug === slug);
}
