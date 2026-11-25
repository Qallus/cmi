// The Hero email block: a dark band with an (optionally animated GIF)
// background, logo, eyebrow, a title with accent words, a facts list and a
// three-colour stripe. Used by the email builder and the event invitation
// emails. Pure, no imports, so it's unit-tested and shared.
//
// Email support: the GIF sits behind the text as a background image, which
// Gmail, Apple Mail, iOS and most webmail animate. Outlook for Windows ignores
// background images and shows the solid `bg_color` instead, so the text always
// has contrast.

export type HeroFact = { label: string; value: string };

export type HeroFields = {
  hero_image?: string;
  bg_color?: string;
  logo_url?: string;
  logo_width?: number;
  eyebrow?: string;
  text?: string;
  title_accent?: string;
  accent_color?: string;
  color?: string;
  muted_color?: string;
  hero_facts?: HeroFact[];
  stripe?: string[];
  align?: "left" | "center" | "right";
};

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Only plain http(s) image URLs go into the markup. */
function safeImg(url: string | undefined): string {
  const u = (url ?? "").trim();
  return /^https?:\/\/[^\s"'()<>]+$/i.test(u) ? u : "";
}

function color(v: string | undefined, fallback: string): string {
  const c = (v ?? "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(c) || /^rgba?\([\d\s.,%]+\)$/i.test(c) ? c : fallback;
}

function titleHtml(title: string, accent: string, accentColor: string): string {
  const a = accent.trim();
  const i = a ? title.lastIndexOf(a) : -1;
  if (i < 0) return esc(title);
  return `${esc(title.slice(0, i))}<span style="color:${accentColor};">${esc(a)}</span>${esc(title.slice(i + a.length))}`;
}

/** Everything inside the hero cell (used by the email and the editor preview). */
export function heroInnerHtml(b: HeroFields, appUrl: string): string {
  const ink = color(b.color, "#ffffff");
  const muted = color(b.muted_color, "#c9a46e");
  const accent = color(b.accent_color, "#e0392b");
  const ta = b.align === "center" ? "center" : b.align === "right" ? "right" : "left";
  const logo = safeImg(b.logo_url) || (b.logo_url === "" ? "" : `${appUrl}/brand/cmi_line_logo_white.png`);
  const logoW = Math.min(Math.max(Number(b.logo_width) || 150, 60), 300);
  const logoMargin = ta === "center" ? "margin:0 auto;" : ta === "right" ? "margin:0 0 0 auto;" : "margin:0;";
  const facts = (b.hero_facts ?? []).filter((f) => f && (f.label?.trim() || f.value?.trim()));
  const parts: string[] = [];
  if (logo) parts.push(`<img src="${esc(logo)}" alt="Constructed Matter, Inc." width="${logoW}" style="display:block;${logoMargin}height:auto;max-width:100%;border:0;" />`);
  if (b.eyebrow?.trim()) parts.push(`<p style="margin:28px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${muted};font-weight:600;text-align:${ta};">${esc(b.eyebrow.trim())}</p>`);
  if (b.text?.trim()) parts.push(`<h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;font-weight:700;color:${ink};text-align:${ta};">${titleHtml(b.text.trim(), b.title_accent ?? "", accent)}</h1>`);
  if (facts.length) {
    const rows = facts
      .map((f) => `<tr><td valign="top" style="padding:6px 18px 0 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${ink};opacity:0.65;white-space:nowrap;">${esc(f.label ?? "")}</td><td valign="top" style="padding:4px 0 0;font-size:15px;line-height:1.5;color:${ink};font-weight:600;">${esc(f.value ?? "").replace(/\n/g, "<br/>")}</td></tr>`)
      .join("");
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px ${ta === "center" ? "auto" : "0"} 0;">${rows}</table>`);
  }
  return parts.join("\n");
}

/** The hero as email table rows (the band, then the stripe). */
export function heroRowsHtml(b: HeroFields, appUrl: string): string {
  const bg = color(b.bg_color, "#1b1b1b");
  const img = safeImg(b.hero_image);
  const bgStyle = img
    ? `background-color:${bg};background-image:url('${img}');background-size:cover;background-position:center;background-repeat:no-repeat;`
    : `background-color:${bg};`;
  const stripe = (b.stripe ?? []).map((c) => color(c, "")).filter(Boolean).slice(0, 4);
  const stripeRow = stripe.length
    ? `<tr><td style="padding:0;font-size:0;line-height:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${stripe
        .map((c) => `<td height="5" bgcolor="${c}" style="height:5px;background:${c};font-size:0;line-height:0;">&nbsp;</td>`)
        .join("")}</tr></table></td></tr>`
    : "";
  return `<tr><td bgcolor="${bg}"${img ? ` background="${esc(img)}"` : ""} style="${bgStyle}padding:36px 40px 40px;">
${heroInnerHtml(b, appUrl)}
</td></tr>${stripeRow}`;
}
