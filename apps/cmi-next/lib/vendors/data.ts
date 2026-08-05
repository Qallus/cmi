import { getSupabaseAdmin } from "@/lib/supabase/server";

export type Vendor = {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  category: string | null;
  status: string | null;
};

// Active vendors for the Live Selection Builder vendor picker.
export async function listVendors(): Promise<Vendor[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("selection_vendors")
    .select("id, name, website_url, logo_url, category, status")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Vendor[];
}

export async function createVendor(input: {
  name: string;
  website_url?: string | null;
  logo_url?: string | null;
  category?: string | null;
}): Promise<Vendor> {
  const { data, error } = await getSupabaseAdmin()
    .from("selection_vendors")
    .upsert(
      {
        name: input.name.trim(),
        website_url: input.website_url?.trim() || null,
        logo_url: input.logo_url?.trim() || null,
        category: input.category?.trim() || null,
        status: "active",
      },
      { onConflict: "name" },
    )
    .select("id, name, website_url, logo_url, category, status")
    .single();
  if (error) throw new Error(error.message);
  return data as Vendor;
}
