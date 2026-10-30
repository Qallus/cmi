import { getSupabaseAdmin } from "@/lib/supabase/server";
import { SiteContentHub } from "./site-content-hub";
import { SitePagesPanel } from "./site-pages-panel";
import { getSessionStaff } from "@/lib/auth/server-session";
import { listPages, type SitePage } from "@/lib/site-pages/data";

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
  // Landing pages are a Super Admin feature (managed through Claude).
  const staff = await getSessionStaff();
  const pages: SitePage[] | null = staff?.role_slug === "super_admin" ? await listPages().catch(() => []) : null;
  const panel = pages ? <SitePagesPanel pages={pages} /> : null;
  try {
    const blocks = await loadBlocks();
    return <>{panel}<SiteContentHub initialBlocks={blocks} /></>;
  } catch {
    return <>{panel}<SiteContentHub initialBlocks={[]} /></>;
  }
}
