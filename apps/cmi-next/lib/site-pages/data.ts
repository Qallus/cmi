// Website pages managed from the dashboard and Claude (MCP Phase F): landing
// pages at /lp/<slug> built from the MicroLanding template. A page keeps a
// draft and a published copy; publishing saves a version for rollback.
// Super Admin only (enforced by callers). Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MicroLandingContent } from "@/components/site/micro-landing";

export class SitePageError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type PageContent = { title: string; description: string; landing: MicroLandingContent };

export type SitePage = {
  id: string;
  slug: string;
  draft: PageContent;
  published: PageContent | null;
  status: "draft" | "published" | "unpublished";
  published_at: string | null;
  published_by: string | null;
  preview_token: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SitePageVersion = { id: string; page_id: string; content: PageContent; note: string | null; created_by: string | null; created_at: string };

/** Hand-built pages under /lp that a CMS page may not take over. */
export const RESERVED_SLUGS = ["construction-sucks", "design-build-enjoy"];

const DEFAULT_LANDING: MicroLandingContent = {
  brand: "Constructed Matter",
  source: "constructedmatter.com",
  domain: "constructedmatter.com",
  theme: "light",
  heroImage: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/589cd039-0f3e-488c-a28a-dc00086c6c8a/Conrad+Residence-13.jpg",
  eyebrow: "Constructed Matter, Inc.",
  headline: "",
  sub: "",
  primaryCta: "Start Your Project",
  pitchTitle: "",
  pitchBody: "",
  bullets: [],
  formTitle: "Let’s talk about your project.",
  formSub: "Tell us a little about what you have in mind and we’ll set up a free, no-pressure consultation.",
  formCta: "Request My Free Consultation",
};

const LANDING_KEYS = Object.keys(DEFAULT_LANDING).concat(["headlineTwist", "painTitle", "pains"]);
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** Merge an edit into landing content, keeping only known fields of the right shape. */
export function mergeLanding(base: MicroLandingContent, patch: Record<string, unknown> | null | undefined): MicroLandingContent {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (!LANDING_KEYS.includes(k)) continue;
    if (k === "theme") { if (v === "dark" || v === "light") out.theme = v; continue; }
    if (k === "bullets") {
      if (Array.isArray(v)) out.bullets = v.slice(0, 12).map((b) => ({ title: str((b as Record<string, unknown>)?.title, 120) ?? "", body: str((b as Record<string, unknown>)?.body, 600) ?? "" })).filter((b) => b.title || b.body);
      continue;
    }
    if (k === "pains") { if (Array.isArray(v)) out.pains = v.slice(0, 12).map((p) => str(p, 300) ?? "").filter(Boolean); continue; }
    const sv = str(v);
    if (sv !== undefined) out[k] = sv;
  }
  return out as MicroLandingContent;
}

/** What still has to be filled in before a page can go live. */
export function missingForPublish(c: PageContent): string[] {
  const l = c.landing;
  const missing: string[] = [];
  if (!c.title) missing.push("title");
  if (!c.description) missing.push("description");
  for (const k of ["headline", "sub", "heroImage", "pitchTitle", "pitchBody", "formTitle", "formCta", "primaryCta"] as const) if (!l[k]) missing.push(`landing.${k}`);
  if (!l.bullets.length) missing.push("landing.bullets (at least one)");
  return missing;
}

export function normalizeSlug(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const sb = () => getSupabaseAdmin();

export async function listPages(): Promise<SitePage[]> {
  const { data, error } = await sb().from("site_pages").select("*").is("deleted_at", null).order("updated_at", { ascending: false });
  if (error) throw new SitePageError(error.message, 500);
  return (data ?? []) as SitePage[];
}

export async function getPage(idOrSlug: string): Promise<SitePage | null> {
  const col = /^[0-9a-f-]{36}$/i.test(idOrSlug) ? "id" : "slug";
  const { data } = await sb().from("site_pages").select("*").eq(col, idOrSlug).is("deleted_at", null).maybeSingle();
  return (data as SitePage) ?? null;
}

export async function createPage(input: { slug: string; title: string; description?: string; landing?: Record<string, unknown> }, actorId: string): Promise<SitePage> {
  const slug = normalizeSlug(input.slug);
  if (!slug) throw new SitePageError("Give the page a web address (slug), e.g. 'kitchen-remodels'.");
  if (RESERVED_SLUGS.includes(slug)) throw new SitePageError(`/lp/${slug} is a hand-built page and can't be replaced here.`);
  if (await getPage(slug)) throw new SitePageError(`/lp/${slug} already exists. Edit it instead, or pick another address.`, 409);
  const draft: PageContent = {
    title: str(input.title, 160) ?? "", description: str(input.description, 300) ?? "",
    landing: mergeLanding({ ...DEFAULT_LANDING, source: `constructedmatter.com/lp/${slug}` }, input.landing),
  };
  const { data, error } = await sb().from("site_pages").insert({ slug, draft, created_by: actorId, updated_by: actorId }).select("*").single();
  if (error) throw new SitePageError(error.message, 500);
  return data as SitePage;
}

export async function updateDraft(id: string, patch: { title?: string; description?: string; landing?: Record<string, unknown> }, actorId: string): Promise<{ before: SitePage; after: SitePage }> {
  const before = await getPage(id);
  if (!before) throw new SitePageError("No page with that id.", 404);
  const draft: PageContent = {
    title: str(patch.title, 160) ?? before.draft.title,
    description: str(patch.description, 300) ?? before.draft.description,
    landing: mergeLanding(before.draft.landing, patch.landing),
  };
  const { data, error } = await sb().from("site_pages").update({ draft, updated_by: actorId, updated_at: new Date().toISOString() }).eq("id", before.id).select("*").single();
  if (error) throw new SitePageError(error.message, 500);
  return { before, after: data as SitePage };
}

/** Make the draft live, and keep a version of it for rollback. */
export async function publishPage(id: string, actorId: string, note?: string | null): Promise<SitePage> {
  const page = await getPage(id);
  if (!page) throw new SitePageError("No page with that id.", 404);
  const missing = missingForPublish(page.draft);
  if (missing.length) throw new SitePageError(`Fill these in before publishing: ${missing.join(", ")}.`);
  const now = new Date().toISOString();
  await sb().from("site_page_versions").insert({ page_id: page.id, content: page.draft, note: note ?? "Published", created_by: actorId });
  const { data, error } = await sb().from("site_pages").update({
    published: page.draft, status: "published", published_at: now, published_by: actorId, updated_by: actorId, updated_at: now,
  }).eq("id", page.id).select("*").single();
  if (error) throw new SitePageError(error.message, 500);
  return data as SitePage;
}

export async function unpublishPage(id: string, actorId: string): Promise<SitePage> {
  const page = await getPage(id);
  if (!page) throw new SitePageError("No page with that id.", 404);
  const { data, error } = await sb().from("site_pages").update({ status: "unpublished", updated_by: actorId, updated_at: new Date().toISOString() }).eq("id", page.id).select("*").single();
  if (error) throw new SitePageError(error.message, 500);
  return data as SitePage;
}

export async function listVersions(pageId: string): Promise<SitePageVersion[]> {
  const { data } = await sb().from("site_page_versions").select("*").eq("page_id", pageId).order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as SitePageVersion[];
}

/** Roll back: put an earlier version live (and into the draft), recorded as a new version. */
export async function restoreVersion(pageId: string, versionId: string, actorId: string): Promise<SitePage> {
  const page = await getPage(pageId);
  if (!page) throw new SitePageError("No page with that id.", 404);
  const { data: v } = await sb().from("site_page_versions").select("*").eq("id", versionId).eq("page_id", page.id).maybeSingle();
  if (!v) throw new SitePageError("That version isn't from this page.", 404);
  const now = new Date().toISOString();
  await sb().from("site_page_versions").insert({ page_id: page.id, content: v.content, note: `Restored version from ${String(v.created_at).slice(0, 10)}`, created_by: actorId });
  const { data, error } = await sb().from("site_pages").update({
    draft: v.content, published: v.content, status: "published", published_at: now, published_by: actorId, updated_by: actorId, updated_at: now,
  }).eq("id", page.id).select("*").single();
  if (error) throw new SitePageError(error.message, 500);
  return data as SitePage;
}

/** For /lp/[slug]: the live page, or the draft when the preview token matches. */
export async function loadForRoute(slug: string, previewToken?: string | null): Promise<{ content: PageContent; preview: boolean } | null> {
  const page = await getPage(slug);
  if (!page) return null;
  if (previewToken && previewToken === page.preview_token) return { content: page.draft, preview: true };
  if (page.status === "published" && page.published) return { content: page.published, preview: false };
  return null;
}
