import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Full US state / territory name → 2-letter code, so suggestions fill the State
// field with the app's expected abbreviation.
const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
};

// Address autocomplete proxied through the server so we can send Nominatim the
// descriptive User-Agent it asks for (browsers can't). Same free/keyless service
// the job geocoder already uses. Best-effort — returns [] on any failure.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=us&limit=6&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ConstructedMatter-CMI-WebApp/1.0 (address autocomplete)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({ suggestions: [] });
    const rows = (await res.json()) as NominatimResult[];

    const suggestions = rows.map((r) => {
      const a = r.address ?? {};
      const street = [a.house_number, a.road].filter(Boolean).join(" ");
      const city = a.city || a.town || a.village || a.hamlet || a.suburb || "";
      const stateName = (a.state ?? "").toLowerCase();
      const state = STATE_ABBR[stateName] ?? a.state ?? "";
      return {
        label: r.display_name ?? street,
        street,
        city,
        state,
        zip: a.postcode ?? "",
        lat: r.lat ? Number(r.lat) : null,
        lon: r.lon ? Number(r.lon) : null,
      };
    }).filter((s) => s.street || s.city);

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
