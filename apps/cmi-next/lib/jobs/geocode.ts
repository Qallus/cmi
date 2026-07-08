// Best-effort geocoding via OpenStreetMap Nominatim (free, no key). Used when a
// job is created/updated with an address but no lat/long. Failures are silent —
// the job still saves, it just won't appear on the map until coordinates exist.
// Nominatim asks for a descriptive User-Agent and is rate-limited (~1 req/s), so
// this is best-effort only, not a bulk geocoder.

export async function geocodeAddress(parts: {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}): Promise<{ latitude: number; longitude: number } | null> {
  const query = [parts.street_address, parts.city, parts.state, parts.zip_code]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (!query) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ConstructedMatter-CMI-WebApp/1.0 (jobs map geocoder)" },
      // Don't let a slow geocoder block a save for long.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat?: string; lon?: string }[];
    const hit = rows[0];
    if (!hit?.lat || !hit?.lon) return null;
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null; // best-effort
  }
}
