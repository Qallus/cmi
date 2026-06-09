import { getSupabaseAdmin } from "@/lib/supabase/server";
import { SiteContentClient } from "./site-content-client";

export const metadata = { title: "Site Content — CMI Dashboard" };

export type ContentBlock = {
  id: string;
  key: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  button_label: string | null;
  button_url: string | null;
  image_url: string | null;
  pages: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

async function loadBlocks(): Promise<ContentBlock[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("site_content").select("*").order("type").order("key");
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentBlock[];
}

export default async function SiteContentPage() {
  try {
    const blocks = await loadBlocks();
    return <SiteContentClient initialBlocks={blocks} />;
  } catch {
    return <SiteContentClient initialBlocks={[]} />;
  }
}
