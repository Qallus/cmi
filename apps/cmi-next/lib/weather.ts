// Weather for daily logs, from Open-Meteo (free, no API key).
//
// Looks up the day's conditions at the job or Pre-Con site so nobody has to
// type "Sunny, 98°F" into every log. Never throws: if the site can't be
// located or the service is down, the log saves without weather.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/jobs/geocode";

export type DayWeather = { weather: string; temperature: string };

/** CMI's office, 7314 E Osborn Dr, Scottsdale: used when a site has no location. */
const OFFICE = { latitude: 33.4877, longitude: -111.9226 };

// WMO weather interpretation codes → plain words.
function describe(code: number): string {
  if (code === 0) return "Sunny";
  if (code === 1) return "Mostly sunny";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed";
}

/** The day's conditions and high/low at a point, for a YYYY-MM-DD date. */
export async function weatherFor(latitude: number, longitude: number, date: string): Promise<DayWeather | null> {
  // The forecast API covers roughly the last 90 days and the next 2 weeks;
  // anything older comes from the historical archive.
  const ageDays = (Date.now() - new Date(`${date}T12:00:00Z`).getTime()) / 86_400_000;
  const base = ageDays > 85 ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const url = `${base}?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min`
    + `&temperature_unit=fahrenheit&timezone=America%2FPhoenix&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: { weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] } };
    const code = json.daily?.weather_code?.[0];
    const hi = json.daily?.temperature_2m_max?.[0];
    const lo = json.daily?.temperature_2m_min?.[0];
    if (code == null || hi == null) return null;
    return {
      weather: describe(code),
      temperature: lo != null ? `${Math.round(hi)}°F / ${Math.round(lo)}°F` : `${Math.round(hi)}°F`,
    };
  } catch {
    return null;
  }
}

/** Where a Job or Pre-Con is: stored coordinates, else its address, else the office. */
export async function siteLocation(kind: "job" | "opportunity" | "deal", id: string): Promise<{ latitude: number; longitude: number }> {
  const sb = getSupabaseAdmin();
  try {
    if (kind === "job") {
      const { data } = await sb.from("jobs").select("latitude, longitude, street_address, city, state, zip_code").eq("id", id).maybeSingle();
      const j = data as { latitude: number | null; longitude: number | null; street_address: string | null; city: string | null; state: string | null; zip_code: string | null } | null;
      if (j?.latitude != null && j.longitude != null) return { latitude: j.latitude, longitude: j.longitude };
      if (j) return (await geocodeAddress(j)) ?? OFFICE;
    } else if (kind === "deal") {
      const { data } = await sb.from("deals").select("latitude, longitude, street_address, city, state, zip").eq("id", id).maybeSingle();
      const d = data as { latitude: number | null; longitude: number | null; street_address: string | null; city: string | null; state: string | null; zip: string | null } | null;
      if (d?.latitude != null && d.longitude != null) return { latitude: d.latitude, longitude: d.longitude };
      if (d) return (await geocodeAddress({ street_address: d.street_address, city: d.city, state: d.state, zip_code: d.zip })) ?? OFFICE;
    } else {
      const { data } = await sb.from("pipeline_opportunities").select("project_address, city, state, zip_code").eq("id", id).maybeSingle();
      const o = data as { project_address: string | null; city: string | null; state: string | null; zip_code: string | null } | null;
      if (o) return (await geocodeAddress({ street_address: o.project_address, city: o.city, state: o.state, zip_code: o.zip_code })) ?? OFFICE;
    }
  } catch { /* fall through to the office */ }
  return OFFICE;
}

export async function weatherForSite(kind: "job" | "opportunity" | "deal", id: string, date: string): Promise<DayWeather | null> {
  const where = await siteLocation(kind, id);
  return weatherFor(where.latitude, where.longitude, date);
}
