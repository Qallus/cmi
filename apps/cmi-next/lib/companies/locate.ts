// Map coordinates for trade partner companies (Directory → Map view).
// Geocodes the company's address — or just city/state when that's all we
// have — through the same free Nominatim helper jobs and deals use. Nominatim
// allows about one request a second, so batches are small and spaced out.
// Server-only.
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/jobs/geocode";

type Addr = { id: string; street_address: string | null; city: string | null; state: string | null; zip: string | null };

async function locate(c: Addr): Promise<boolean> {
  if (!c.street_address && !c.city && !c.zip) return false;
  const geo = (c.street_address ? await geocodeAddress({ street_address: c.street_address, city: c.city, state: c.state, zip_code: c.zip }) : null)
    // A street that won't resolve still places them in their city.
    ?? await geocodeAddress({ city: c.city, state: c.state || "AZ", zip_code: c.zip });
  if (!geo) return false;
  await getSupabaseAdmin().from("companies").update({ latitude: geo.latitude, longitude: geo.longitude }).eq("id", c.id);
  return true;
}

/** Geocode up to `limit` partner companies that have an address but no coordinates. */
export async function locateMissing(limit = 20): Promise<{ located: number; failed: number; remaining: number }> {
  const { data } = await getSupabaseAdmin().from("companies")
    .select("id, street_address, city, state, zip, partner_type, qualification_status")
    .is("archived_at", null).is("latitude", null)
    .or("street_address.not.is.null,city.not.is.null,zip.not.is.null")
    .limit(500);
  const todo = ((data ?? []) as (Addr & { partner_type: string | null; qualification_status: string | null })[])
    .filter((c) => !!c.partner_type || c.qualification_status !== "prospect");
  let located = 0, failed = 0;
  for (const [i, c] of todo.slice(0, limit).entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    if (await locate(c)) located += 1; else failed += 1;
  }
  return { located, failed, remaining: Math.max(0, todo.length - limit) };
}

/** After a submit or profile change: place this one company, in the background. */
export function queueLocate(companyId: string): void {
  const run = async () => {
    const { data } = await getSupabaseAdmin().from("companies").select("id, street_address, city, state, zip").eq("id", companyId).maybeSingle();
    if (data) await locate(data as Addr).catch(() => false);
  };
  try { after(run); } catch { void run(); }
}
