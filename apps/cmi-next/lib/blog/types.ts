export type BlogStatus = "draft" | "published" | "scheduled" | "archived";

export type BlogPost = {
  id: string;
  wp_post_id: number | null;
  title: string;
  slug: string | null;
  category: string | null;
  tags: string[] | null;
  excerpt: string | null;
  content: string | null;
  featured_image: string | null;
  author: string | null;
  status: BlogStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogDraft = Omit<BlogPost, "id" | "wp_post_id" | "created_at" | "updated_at">;
