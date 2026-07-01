import { getSupabaseAdmin } from "@/lib/supabase/server";
import { SiteContentHub } from "./site-content-hub";

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
  const { data, error } = await supabase.from("site_content_blocks").select("*").order("type").order("key");
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentBlock[];
}

export const dynamic = "force-dynamic";

export default async function SiteContentPage() {
  try {
    const blocks = await loadBlocks();
    return <SiteContentHub initialBlocks={blocks} />;
  } catch {
    return <SiteContentHub initialBlocks={[]} />;
  }
}
