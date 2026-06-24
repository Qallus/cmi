// Public vCard (.vcf) download for a published card. /api/cards/vcf?slug=...
import { loadPublicCardBySlug } from "@/lib/business-cards/data";

function esc(v: string): string {
  return String(v || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return new Response("slug is required", { status: 400 });

  const card = await loadPublicCardBySlug(slug);
  if (!card) return new Response("Card not found", { status: 404 });

  const full = card.display_name || [card.first_name, card.last_name].filter(Boolean).join(" ") || "Contact";
  const last = card.last_name || "";
  const first = card.first_name || full;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://my.constructedmatter.com").replace(/\/$/, "");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(full)}`,
    `N:${esc(last)};${esc(first)};;;`,
    card.company_name ? `ORG:${esc(card.company_name)}` : "",
    card.job_title ? `TITLE:${esc(card.job_title)}` : "",
    card.primary_phone ? `TEL;TYPE=CELL:${esc(card.primary_phone)}` : "",
    card.primary_email ? `EMAIL;TYPE=WORK:${esc(card.primary_email)}` : "",
    card.website_url ? `URL:${esc(card.website_url)}` : "",
    `URL:${base}/c/${esc(card.slug)}`,
    "END:VCARD",
  ].filter(Boolean);

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.slug}.vcf"`,
    },
  });
}
