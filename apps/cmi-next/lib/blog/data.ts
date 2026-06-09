import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { BlogPost, BlogDraft } from "./types";

export async function loadBlogPosts(): Promise<BlogPost[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
}

export async function createBlogPost(draft: BlogDraft): Promise<BlogPost> {
  const supabase = getSupabaseAdmin();
  const slug = draft.slug || draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data, error } = await supabase.from("blog_posts").insert({ ...draft, slug }).select().single();
  if (error) throw new Error(error.message);
  return data as BlogPost;
}

export async function updateBlogPost(id: string, patch: Partial<BlogDraft>): Promise<BlogPost> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("blog_posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BlogPost;
}

export async function deleteBlogPost(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
