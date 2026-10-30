// Phase F MCP tools: website content, Super Admin only (Jeremy, 2026-10-30).
// Landing pages at /lp/<slug> (create, edit the draft, preview, publish,
// unpublish, roll back, delete to the trash), blog posts and portfolio
// projects. Anything that changes the public site previews first and runs
// with cmi_confirm. New layouts, components and routes stay code changes
// (Claude Code / Codex pull requests).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { publicAppUrl } from "@/lib/twilio";
import {
  createPage, getPage, listPages, listVersions, missingForPublish, publishPage, restoreVersion, unpublishPage, updateDraft,
  RESERVED_SLUGS,
} from "@/lib/site-pages/data";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import { trashRecord } from "./trash";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const fields = (description: string) => ({ type: "object", description, additionalProperties: true });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const sb = () => getSupabaseAdmin();
const superAdmin = (c: McpCaller) => c.ctx.role === "super_admin";
const liveUrl = (slug: string) => `${publicAppUrl()}/lp/${slug}`;

const LANDING_HELP = "landing fields: brand, eyebrow, headline, headlineTwist (second line in the accent color), sub, heroImage (image URL), primaryCta, painTitle + pains (optional problem list), pitchTitle, pitchBody, bullets [{title, body}], formTitle, formSub, formCta, theme (light|dark)";

async function pageOrThrow(id: unknown) {
  const p = await getPage(s(id));
  if (!p) throw new Error("No page with that id or address.");
  return p;
}

const pageTools: McpTool[] = [
  {
    name: "cmi_site_pages_list",
    title: "Website landing pages",
    description: "The landing pages managed in CMI (at constructedmatter.com/lp/<address>): status (draft, published, unpublished), last published, and links. Hand-built pages (the rest of the site) are code and listed separately.",
    risk: "read",
    available: superAdmin,
    inputSchema: () => obj(),
    run: async () => ({ result: {
      pages: (await listPages()).map((p) => ({
        id: p.id, address: `/lp/${p.slug}`, title: p.draft.title, status: p.status, published_at: p.published_at, updated_at: p.updated_at,
        live_url: p.status === "published" ? liveUrl(p.slug) : null, unpublished_changes: JSON.stringify(p.draft) !== JSON.stringify(p.published),
      })),
      hand_built_pages: ["/", "/about", "/services", "/portfolio", "/blog", "/contact", "/become-a-trade-partner", ...RESERVED_SLUGS.map((x) => `/lp/${x}`)],
      note: "Hand-built pages change through a code pull request, not these tools.",
    } }),
  },
  {
    name: "cmi_site_page_get",
    title: "Read a landing page",
    description: "One landing page: its draft (what's being edited), what's live, what's still missing before it can be published, and its version history.",
    risk: "read",
    available: superAdmin,
    inputSchema: () => obj({ id: str("Page id or address (e.g. kitchen-remodels)") }, ["id"]),
    run: async (a) => {
      const p = await pageOrThrow(a.id);
      return { result: {
        id: p.id, address: `/lp/${p.slug}`, status: p.status, draft: p.draft, published: p.published, missing_before_publish: missingForPublish(p.draft),
        versions: (await listVersions(p.id)).map((v) => ({ id: v.id, note: v.note, created_at: v.created_at })),
      } };
    },
  },
  {
    name: "cmi_site_page_create",
    title: "Create a landing page (draft)",
    description: `Start a new landing page at /lp/<address> as a draft (not public until published). Give title and description (for search engines and link previews) and the page's ${LANDING_HELP}. Returns a private preview link.`,
    risk: "write",
    available: superAdmin,
    inputSchema: () => obj({ address: str("Web address, e.g. 'kitchen-remodels' → /lp/kitchen-remodels"), title: str("Page title (browser tab, search results)"), description: str("One-sentence description for search and link previews"), landing: fields("Page content") }, ["address", "title"]),
    run: async (a, c) => {
      const p = await createPage({ slug: s(a.address), title: s(a.title), description: s(a.description), landing: (a.landing as Json) ?? {} }, c.ctx.id);
      return { result: { created: true, id: p.id, address: `/lp/${p.slug}`, preview_url: `${liveUrl(p.slug)}?preview=${p.preview_token}`, missing_before_publish: missingForPublish(p.draft) },
        entity: "site_page", recordId: p.id, before: null, after: p.draft };
    },
  },
  {
    name: "cmi_site_page_update",
    title: "Edit a landing page draft",
    description: `Change a landing page's draft: title, description, and any ${LANDING_HELP}. Only the fields you send change (bullets and pains replace the whole list). The live page doesn't change until you publish.`,
    risk: "write",
    available: superAdmin,
    inputSchema: () => obj({ id: str("Page id or address"), title: str("Title"), description: str("Description"), landing: fields("Content fields to change") }, ["id"]),
    run: async (a, c) => {
      const p = await pageOrThrow(a.id);
      const { before, after } = await updateDraft(p.id, { title: s(a.title) || undefined, description: s(a.description) || undefined, landing: (a.landing as Json) ?? undefined }, c.ctx.id);
      return { result: { updated: true, address: `/lp/${after.slug}`, preview_url: `${liveUrl(after.slug)}?preview=${after.preview_token}`, missing_before_publish: missingForPublish(after.draft) },
        entity: "site_page", recordId: p.id, before: before.draft, after: after.draft };
    },
  },
  {
    name: "cmi_site_page_preview",
    title: "Preview link for a landing page",
    description: "A private link that shows the page's current draft (not indexed by search engines). Share it for review before publishing.",
    risk: "read",
    available: superAdmin,
    inputSchema: () => obj({ id: str("Page id or address") }, ["id"]),
    run: async (a) => {
      const p = await pageOrThrow(a.id);
      return { result: { preview_url: `${liveUrl(p.slug)}?preview=${p.preview_token}`, live_url: p.status === "published" ? liveUrl(p.slug) : null } };
    },
  },
  {
    name: "cmi_site_page_publish",
    title: "Publish a landing page",
    description: "Make the page's draft live on constructedmatter.com (Super Admin). A version is saved so it can be rolled back. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: superAdmin,
    inputSchema: () => obj({ id: str("Page id or address"), note: str("What changed (kept in history)") }, ["id"]),
    preview: async (a): Promise<Preview> => {
      const p = await pageOrThrow(a.id);
      const missing = missingForPublish(p.draft);
      if (missing.length) throw new Error(`Fill these in before publishing: ${missing.join(", ")}.`);
      return {
        summary: `Publish "${p.draft.title}" at ${liveUrl(p.slug)}${p.status === "published" ? ", replacing what's live now" : ""}. Check the draft first: ${liveUrl(p.slug)}?preview=${p.preview_token}`,
        details: { headline: p.draft.landing.headline, sub: p.draft.landing.sub }, entity: "site_page", recordId: p.id,
      };
    },
    execute: async (a, c) => {
      const before = await pageOrThrow(a.id);
      const after = await publishPage(before.id, c.ctx.id, s(a.note) || null);
      return { result: { published: true, live_url: liveUrl(after.slug) }, entity: "site_page", recordId: after.id, before: before.published, after: after.published };
    },
  },
  {
    name: "cmi_site_page_unpublish",
    title: "Take a landing page offline",
    description: "Take a published landing page off the site (it returns 'not found'); the draft and history stay. Super Admin. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: superAdmin,
    inputSchema: () => obj({ id: str("Page id or address") }, ["id"]),
    preview: async (a): Promise<Preview> => {
      const p = await pageOrThrow(a.id);
      if (p.status !== "published") throw new Error("That page isn't live.");
      return { summary: `Take ${liveUrl(p.slug)} offline. Links to it will show 'not found' until it's published again.`, entity: "site_page", recordId: p.id };
    },
    execute: async (a, c) => {
      const p = await unpublishPage((await pageOrThrow(a.id)).id, c.ctx.id);
      return { result: { unpublished: true, address: `/lp/${p.slug}` }, entity: "site_page", recordId: p.id, after: { status: p.status } };
    },
  },
  {
    name: "cmi_site_page_restore",
    title: "Roll a landing page back",
    description: "Put an earlier published version back live (from cmi_site_page_get versions). Super Admin. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    available: superAdmin,
    inputSchema: () => obj({ id: str("Page id or address"), version_id: str("Version id") }, ["id", "version_id"]),
    preview: async (a): Promise<Preview> => {
      const p = await pageOrThrow(a.id);
      const v = (await listVersions(p.id)).find((x) => x.id === s(a.version_id));
      if (!v) throw new Error("That version isn't from this page.");
      return { summary: `Roll ${liveUrl(p.slug)} back to the version from ${v.created_at.slice(0, 10)} ("${v.content.title}"). It goes live right away.`, entity: "site_page", recordId: p.id };
    },
    execute: async (a, c) => {
      const before = await pageOrThrow(a.id);
      const after = await restoreVersion(before.id, s(a.version_id), c.ctx.id);
      return { result: { restored: true, live_url: liveUrl(after.slug) }, entity: "site_page", recordId: after.id, before: before.published, after: after.published };
    },
  },
  {
    name: "cmi_site_page_delete",
    title: "Delete a landing page",
    description: "Take a landing page off the site and move it to the trash (restorable with cmi_restore). Super Admin. Previews first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    capGroup: "trash",
    available: superAdmin,
    inputSchema: () => obj({ id: str("Page id or address") }, ["id"]),
    preview: async (a): Promise<Preview> => {
      const p = await pageOrThrow(a.id);
      return { summary: `Delete the landing page /lp/${p.slug} ("${p.draft.title}")${p.status === "published" ? "; it comes off the live site" : ""}. It can be restored.`, entity: "site_page", recordId: p.id };
    },
    execute: async (a, c) => {
      const p = await pageOrThrow(a.id);
      const { trashId, label, before } = await trashRecord("site_page", p.id, c.ctx, "mcp");
      return { result: { deleted: true, label, trash_id: trashId }, entity: "site_page", recordId: p.id, before, after: null };
    },
  },
];

// ─── Blog and portfolio ─────────────────────────────────────────────────────

const BLOG_FIELDS = ["title", "slug", "category", "excerpt", "content", "featured_image", "author", "tags", "featured"] as const;
const PORTFOLIO_FIELDS = ["title", "slug", "subtitle", "category", "year", "location", "description", "featured_image", "gallery_images",
  "timeline", "square_feet", "tags", "services_used", "architect", "interior_designer", "is_featured", "video_urls"] as const;
const pick = (src: unknown, keys: readonly string[]) => Object.fromEntries(Object.entries((src as Json) ?? {}).filter(([k]) => keys.includes(k)));
const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/** One table's list/save/publish/unpublish/delete tools: blog_posts or portfolio. */
function contentTools(kind: "blog" | "portfolio"): McpTool[] {
  const table = kind === "blog" ? "blog_posts" : "portfolio";
  const noun = kind === "blog" ? "blog post" : "portfolio project";
  const keys = kind === "blog" ? BLOG_FIELDS : PORTFOLIO_FIELDS;
  const path = kind === "blog" ? "blog" : "portfolio";
  const trashKey = kind === "blog" ? "blog_post" : "portfolio_item";
  const load = async (id: unknown) => {
    let q = sb().from(table).select("*").eq("id", s(id));
    if (kind === "portfolio") q = q.is("deleted_at", null);
    const { data } = await q.maybeSingle();
    if (!data) throw new Error(`No ${noun} with that id.`);
    return data as Json;
  };
  return [
    {
      name: `cmi_${kind}_list`,
      title: kind === "blog" ? "Blog posts" : "Portfolio projects",
      description: `The site's ${noun}s with status (draft, published…), newest first. Pass id for one in full.`,
      risk: "read",
      available: superAdmin,
      inputSchema: () => obj({ id: str("One item's id (optional)"), status: str("Filter by status") }),
      run: async (a) => {
        if (s(a.id)) return { result: await load(a.id) };
        let q = sb().from(table).select(kind === "blog" ? "id, title, slug, status, category, published_at, updated_at" : "id, title, slug, status, category, location, year, is_featured, updated_at")
          .order("updated_at", { ascending: false }).limit(100);
        if (kind === "portfolio") q = q.is("deleted_at", null);
        if (s(a.status)) q = q.eq("status", s(a.status));
        const { data } = await q;
        return { result: { items: data ?? [] } };
      },
    },
    {
      name: `cmi_${kind}_save`,
      title: `Draft or edit a ${noun}`,
      description: `Create a new ${noun} as a draft, or edit one that isn't live (${keys.join(", ")}). A published ${noun} changes through cmi_${kind}_publish so the change is previewed first.`,
      risk: "write",
      available: superAdmin,
      inputSchema: () => obj({ id: str(`Existing ${noun} id (omit to create)`), fields: fields("Fields to set") }, ["fields"]),
      run: async (a) => {
        const patch = pick(a.fields, keys);
        if (s(a.id)) {
          const before = await load(a.id);
          if (before.status === "published") return { result: { error: `That ${noun} is live. Use cmi_${kind}_publish with the changes so they're previewed first.` } };
          const { data, error } = await sb().from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq("id", before.id as string).select("*").single();
          if (error) return { result: { error: error.message } };
          return { result: { updated: true, item: data }, entity: trashKey, recordId: String(before.id), before, after: data };
        }
        if (!s(patch.title)) return { result: { error: "Give it a title." } };
        const { data, error } = await sb().from(table).insert({ ...patch, slug: s(patch.slug) || slugify(s(patch.title)), status: "draft" }).select("*").single();
        if (error) return { result: { error: error.message } };
        return { result: { created: true, item: data, note: "Saved as a draft; it isn't on the site until published." }, entity: trashKey, recordId: String(data.id), before: null, after: data };
      },
    },
    {
      name: `cmi_${kind}_publish`,
      title: `Publish a ${noun}`,
      description: `Put a ${noun} live on the site, optionally with changes (${keys.join(", ")}). Super Admin. Previews first; runs with cmi_confirm.`,
      risk: "high",
      openWorld: true,
      available: superAdmin,
      inputSchema: () => obj({ id: str(`${noun} id`), fields: fields("Changes to make as it goes live (optional)") }, ["id"]),
      preview: async (a): Promise<Preview> => {
        const item = await load(a.id);
        const patch = pick(a.fields, keys);
        const title = s(patch.title) || String(item.title);
        return {
          summary: `${item.status === "published" ? "Update the live" : "Publish the"} ${noun} "${title}" at ${publicAppUrl()}/${path}/${s(patch.slug) || item.slug}${Object.keys(patch).length ? ` with changes to ${Object.keys(patch).join(", ")}` : ""}.`,
          details: { changes: patch }, entity: trashKey, recordId: String(item.id),
        };
      },
      execute: async (a) => {
        const before = await load(a.id);
        const patch: Json = { ...pick(a.fields, keys), status: "published", updated_at: new Date().toISOString() };
        if (kind === "blog" && !before.published_at) patch.published_at = new Date().toISOString();
        const { data, error } = await sb().from(table).update(patch).eq("id", before.id as string).select("*").single();
        if (error) throw new Error(error.message);
        return { result: { published: true, url: `${publicAppUrl()}/${path}/${data.slug}` }, entity: trashKey, recordId: String(data.id), before, after: data };
      },
    },
    {
      name: `cmi_${kind}_unpublish`,
      title: `Unpublish a ${noun}`,
      description: `Take a ${noun} off the site (back to draft). Super Admin. Previews first; runs with cmi_confirm.`,
      risk: "high",
      openWorld: true,
      available: superAdmin,
      inputSchema: () => obj({ id: str(`${noun} id`) }, ["id"]),
      preview: async (a): Promise<Preview> => {
        const item = await load(a.id);
        if (item.status !== "published") throw new Error(`That ${noun} isn't live.`);
        return { summary: `Take the ${noun} "${item.title}" off the site (it goes back to draft).`, entity: trashKey, recordId: String(item.id) };
      },
      execute: async (a) => {
        const before = await load(a.id);
        const { data, error } = await sb().from(table).update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", before.id as string).select("*").single();
        if (error) throw new Error(error.message);
        return { result: { unpublished: true }, entity: trashKey, recordId: String(data.id), before, after: data };
      },
    },
    {
      name: `cmi_${kind}_delete`,
      title: `Delete a ${noun}`,
      description: `Move a ${noun} to the trash (off the site; restorable with cmi_restore). Super Admin. Previews first; runs with cmi_confirm.`,
      risk: "high",
      openWorld: true,
      capGroup: "trash",
      available: superAdmin,
      inputSchema: () => obj({ id: str(`${noun} id`) }, ["id"]),
      preview: async (a): Promise<Preview> => {
        const item = await load(a.id);
        return { summary: `Delete the ${noun} "${item.title}"${item.status === "published" ? " (it comes off the site)" : ""}. It can be restored.`, entity: trashKey, recordId: String(item.id) };
      },
      execute: async (a, c) => {
        const { trashId, label, before } = await trashRecord(trashKey, s(a.id), c.ctx, "mcp");
        return { result: { deleted: true, label, trash_id: trashId }, entity: trashKey, recordId: s(a.id), before, after: null };
      },
    },
  ];
}

export function siteTools(): McpTool[] {
  return [...pageTools, ...contentTools("blog"), ...contentTools("portfolio")];
}
