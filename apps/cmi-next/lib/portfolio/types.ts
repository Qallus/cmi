export type PortfolioStatus = "draft" | "published" | "hidden" | "archived";

export type PortfolioAttribute = {
  label: string;
  value: string;
};

export type PortfolioItem = {
  id: string;
  project_id: string | null;
  wp_post_id: number | null;
  title: string;
  slug: string | null;
  subtitle: string | null;
  category: string | null;
  year: number | null;
  location: string | null;
  timeline: string | null;
  square_feet: number | null;
  description: string | null;
  featured_image: string | null;
  gallery_images: string[] | null;
  video_urls: string[] | null;
  services_used: string[] | null;
  attributes_json: PortfolioAttribute[] | null;
  tags: string[] | null;
  status: PortfolioStatus;
  is_featured: boolean;
  client_visible: boolean;
  sort_order: number | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PortfolioInput = {
  title: string;
  slug?: string | null;
  subtitle?: string | null;
  category?: string | null;
  year?: number | null;
  location?: string | null;
  timeline?: string | null;
  square_feet?: number | null;
  description?: string | null;
  featured_image?: string | null;
  gallery_images?: string[];
  video_urls?: string[];
  services_used?: string[];
  attributes_json?: PortfolioAttribute[];
  tags?: string[];
  status?: PortfolioStatus;
  is_featured?: boolean;
  client_visible?: boolean;
  sort_order?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
};
