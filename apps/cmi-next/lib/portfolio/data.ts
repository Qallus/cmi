import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PortfolioInput, PortfolioItem, PortfolioStatus } from "./types";

const statuses = new Set<PortfolioStatus>(["draft", "published", "hidden", "archived"]);

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parseLines(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function normalizePortfolioInput(input: Record<string, unknown>): PortfolioInput {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("Portfolio title is required.");

  const rawAttributes = Array.isArray(input.attributes_json) ? input.attributes_json : [];
  const attributes_json = rawAttributes
    .map(item => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = String(row.label || "").trim();
      const value = String(row.value || "").trim();
      return label && value ? { label, value } : null;
    })
    .filter(Boolean) as PortfolioInput["attributes_json"];

  const status = statuses.has(String(input.status) as PortfolioStatus) ? String(input.status) as PortfolioStatus : "draft";
  const slug = String(input.slug || "").trim() || slugify(title);

  return {
    title,
    slug,
    subtitle: input.subtitle ? String(input.subtitle).trim() : null,
    category: input.category ? String(input.category).trim() : null,
    year: Number.isFinite(Number(input.year)) ? Number(input.year) : null,
    location: input.location ? String(input.location).trim() : null,
    timeline: input.timeline ? String(input.timeline).trim() : null,
    square_feet: Number.isFinite(Number(input.square_feet)) ? Number(input.square_feet) : null,
    description: input.description ? String(input.description).trim() : null,
    featured_image: input.featured_image ? String(input.featured_image).trim() : null,
    gallery_images: parseLines(input.gallery_images),
    video_urls: parseLines(input.video_urls),
    services_used: parseLines(input.services_used),
    attributes_json,
    tags: parseLines(input.tags),
    status,
    is_featured: Boolean(input.is_featured),
    client_visible: input.client_visible !== false,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 0
  };
}

export async function loadPortfolioItems(options: { publishedOnly?: boolean; featuredOnly?: boolean } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("portfolio")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (options.publishedOnly) query = query.eq("status", "published").eq("client_visible", true);
  if (options.featuredOnly) query = query.eq("is_featured", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PortfolioItem[];
}

export async function loadPortfolioItemBySlug(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("portfolio")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("client_visible", true)
    .single();

  if (error) throw error;
  return data as PortfolioItem;
}
