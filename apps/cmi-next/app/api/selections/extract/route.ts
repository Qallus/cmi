import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";

// Server-side product metadata extraction. Fetches the vendor product page and
// parses OpenGraph / JSON-LD (schema.org Product) into structured fields. This
// respects vendor protections: it makes a single normal GET, never bypasses CSP,
// X-Frame-Options, auth, or anti-bot. A blocked page is an expected result, not
// an error — the UI falls back to manual entry.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .trim();
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i");
    const m = html.match(re1) || html.match(re2);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function absolutize(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function parseJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

function findProduct(nodes: any[]): any | null {
  const flat: any[] = [];
  const push = (n: any) => {
    if (!n || typeof n !== "object") return;
    flat.push(n);
    if (Array.isArray(n["@graph"])) n["@graph"].forEach(push);
  };
  nodes.forEach(push);
  return (
    flat.find((n) => {
      const t = n["@type"];
      return t === "Product" || (Array.isArray(t) && t.includes("Product"));
    }) || null
  );
}

export async function POST(req: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { url } = (await req.json()) as { url?: string };
    const target = (url || "").trim();
    if (!/^https?:\/\//i.test(target)) {
      return NextResponse.json({ ok: false, reason: "invalid_url", message: "Enter a valid http(s) URL." }, { status: 400 });
    }

    let res: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      res = await fetch(target, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      return NextResponse.json({ ok: false, reason: "unreachable", message: "Could not reach the page. Open it in a new tab and enter details manually." });
    }

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        reason: "blocked",
        status: res.status,
        message: `The vendor blocked automated access (HTTP ${res.status}). Open the page and enter details manually.`,
      });
    }

    const html = (await res.text()).slice(0, 1_500_000);
    const ld = findProduct(parseJsonLd(html)) || {};
    const offers = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;

    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title =
      (ld.name && String(ld.name)) ||
      metaContent(html, ["og:title", "twitter:title"]) ||
      (titleTag ? decodeEntities(titleTag[1]) : null);
    const description =
      (ld.description && stripTags(String(ld.description))) ||
      metaContent(html, ["og:description", "twitter:description", "description"]);
    const ldImage = Array.isArray(ld.image) ? ld.image[0] : typeof ld.image === "object" && ld.image ? ld.image.url : ld.image;
    const image = absolutize(
      (ldImage && String(ldImage)) || metaContent(html, ["og:image", "og:image:url", "twitter:image"]),
      target,
    );
    const price = offers?.price != null ? String(offers.price) : metaContent(html, ["product:price:amount", "og:price:amount"]);
    const currency = offers?.priceCurrency || metaContent(html, ["product:price:currency", "og:price:currency"]) || null;
    const sku = (ld.sku && String(ld.sku)) || (ld.mpn && String(ld.mpn)) || null;
    const brand = ld.brand ? (typeof ld.brand === "object" ? ld.brand.name : String(ld.brand)) : metaContent(html, ["og:site_name"]);

    const images: string[] = [];
    if (Array.isArray(ld.image)) {
      for (const i of ld.image) {
        const u = absolutize(typeof i === "object" ? i?.url : i, target);
        if (u) images.push(u);
      }
    }
    if (image && !images.includes(image)) images.unshift(image);

    const found = Boolean(title || image || price || description);
    return NextResponse.json({
      ok: true,
      found,
      data: {
        title: title || null,
        description: description || null,
        image: image || null,
        images: images.slice(0, 8),
        price: price || null,
        currency,
        sku,
        brand: brand || null,
        sourceUrl: target,
      },
      message: found ? undefined : "No product metadata found on this page. Enter details manually.",
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "error", message: "Extraction failed. Enter details manually." }, { status: 500 });
  }
}
