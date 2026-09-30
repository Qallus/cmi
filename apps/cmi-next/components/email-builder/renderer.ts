import { EMAIL_DEFAULTS, LIST_MARKERS, type EmailBlock, type EmailSettings, type ColumnItem, type ListStyle } from "./types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";

function align(a?: string) {
  return a === "right" ? "right" : a === "left" ? "left" : "center";
}

function rowBg(block: EmailBlock): string {
  return block.section_bg
    ? ` bgcolor="${block.section_bg}" style="background:${block.section_bg};"`
    : "";
}

function tdPad(block: EmailBlock, defT: number, defX: number, defB: number): string {
  const t = block.pad_top    ?? defT;
  const l = block.pad_left   ?? block.pad_x ?? defX;
  const r = block.pad_right  ?? block.pad_x ?? defX;
  const b = block.pad_bottom ?? defB;
  return `padding:${t}px ${r}px ${b}px ${l}px;`;
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A list, as a table.
 *
 * Outlook ignores most list-style CSS and Gmail strips the padding off a <ul>,
 * so the marker gets its own cell instead of being a real bullet. Ugly markup,
 * but it is the only version that looks the same everywhere.
 */
function renderList(opts: {
  items?: string[]; style?: ListStyle; icon?: string; markerColor?: string;
  color?: string; fontSize?: number; spacing?: number; lineHeight?: number;
}): string {
  const items = (opts.items ?? []).filter((i) => i.trim() !== "");
  if (items.length === 0) return "";
  const style = opts.style ?? "bullet";
  const size = opts.fontSize ?? 15;
  const color = opts.color ?? "#4b5563";
  const marker = opts.markerColor ?? color;
  const gap = opts.spacing ?? 8;
  const lh = opts.lineHeight ?? 1.6;

  const rows = items.map((item, i) => {
    const bullet = style === "number"
      ? (i + 1) + "."
      : style === "icon"
        ? (opts.icon || LIST_MARKERS.bullet)
        : (LIST_MARKERS[style as keyof typeof LIST_MARKERS] ?? LIST_MARKERS.bullet);
    const pad = i === items.length - 1 ? 0 : gap;
    return `<tr>
        <td valign="top" style="padding:0 8px ${pad}px 0;font-size:${size}px;line-height:${lh};color:${marker};white-space:nowrap;">${esc(bullet)}</td>
        <td valign="top" style="padding:0 0 ${pad}px;font-size:${size}px;line-height:${lh};color:${color};">${esc(item)}</td>
      </tr>`;
  }).join("\n      ");

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;">
      ${rows}
    </table>`;
}

// A column is a composite stack: any of image, heading, body text, and button
// (in that order) — whichever fields the user fills in.
function renderColumnItem(col: ColumnItem): string {
  const ta = align(col.align);
  const parts: string[] = [];
  if (col.src) {
    const img = `<img src="${col.src}" alt="${col.alt ?? ""}" style="display:block;width:100%;height:auto;max-width:100%;margin-bottom:8px;" />`;
    parts.push(col.link ? `<a href="${col.link}" style="display:block;">${img}</a>` : img);
  }
  if (col.text) parts.push(`<div style="margin:0 0 4px;font-size:${col.heading_size ?? 16}px;font-weight:700;color:${col.heading_color ?? "#111111"};line-height:1.3;text-align:${ta};">${col.text}</div>`);
  if (col.content) parts.push(`<p style="margin:0 0 6px;font-size:${col.font_size ?? 14}px;color:${col.color ?? "#4b5563"};line-height:${col.line_height ?? 1.6};text-align:${ta};">${col.content.replace(/\n/g, "<br/>")}</p>`);
  if (col.items?.length) parts.push(renderList({
    items: col.items, style: col.list_style, icon: col.list_icon,
    markerColor: col.marker_color, color: col.color, fontSize: col.font_size, lineHeight: col.line_height,
  }));
  if (col.label) parts.push(`<table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="text-align:${ta};"><a href="${col.url ?? "#"}" style="display:inline-block;background:${col.btn_bg ?? "#C87A3A"};color:${col.btn_color ?? "#ffffff"};border-radius:${col.btn_radius ?? 6}px;padding:10px 20px;font-size:13px;font-weight:700;text-decoration:none;">${col.label}</a></td></tr></table>`);
  return parts.join("\n") || `<div style="height:40px;"></div>`;
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "header": {
      const bg   = block.bg_color ?? "#111111";
      // PNG, not the SVG the site uses: Gmail and Outlook strip SVG, so an
      // <img> pointing at one renders as nothing.
      const logo = block.logo_url ?? `${APP_URL}/brand/cmi_line_logo_white.png`;
      const w    = block.logo_width ?? 180;
      const ta   = align(block.align);
      const pad  = tdPad(block, 28, 40, 28);
      // `margin` places the logo, because text-align does not move a
      // display:block image in Outlook.
      const margin = ta === "center" ? "margin:0 auto;" : ta === "right" ? "margin:0 0 0 auto;" : "margin:0;";
      return `<tr${rowBg(block)}><td style="${pad}background:${bg};text-align:${ta};">
  <img src="${logo}" alt="Logo" width="${w}" style="display:block;${margin}height:auto;max-width:100%;" />
</td></tr>`;
    }

    case "heading": {
      const tag = block.level ?? "h1";
      const fs  = block.font_size ?? (tag === "h1" ? 28 : tag === "h2" ? 22 : 18);
      const col = block.color ?? "#111111";
      const ta  = align(block.align);
      const pad = tdPad(block, 24, 40, 8);
      return `<tr${rowBg(block)}><td style="${pad}">
  <${tag} style="margin:0;font-size:${fs}px;font-weight:700;color:${col};line-height:${block.line_height ?? 1.3};text-align:${ta};">${block.text ?? "Heading"}</${tag}>
</td></tr>`;
    }

    case "text": {
      const col = block.color ?? "#4b5563";
      const fs  = block.font_size ?? 15;
      const ta  = align(block.align);
      const pad = tdPad(block, 8, 40, 8);
      return `<tr${rowBg(block)}><td style="${pad}">
  <p style="margin:0;font-size:${fs}px;color:${col};line-height:${block.line_height ?? 1.7};text-align:${ta};">${(block.content ?? "Your text here.").replace(/\n/g, "<br/>")}</p>
</td></tr>`;
    }

    case "button": {
      const bg     = block.btn_bg ?? "#C87A3A";
      const col    = block.btn_color ?? "#ffffff";
      const radius = block.btn_radius ?? 6;
      const ta     = align(block.align);
      const href   = block.url ?? "#";
      const lbl    = block.label ?? "Click Here";
      const pad    = tdPad(block, 16, 40, 16);
      return `<tr${rowBg(block)}><td style="${pad}text-align:${ta};">
  <table cellpadding="0" cellspacing="0" style="display:inline-table;">
    <tr><td style="background:${bg};border-radius:${radius}px;">
      <a href="${href}" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:700;color:${col};text-decoration:none;letter-spacing:0.04em;">${lbl} &rarr;</a>
    </td></tr>
  </table>
</td></tr>`;
    }

    case "image": {
      const src = block.src ?? "";
      const alt = block.alt ?? "";
      const w   = block.img_width ?? 480;
      const ta  = align(block.align);
      const pad = tdPad(block, 12, 40, 12);
      const inner = src
        ? `<img src="${src}" alt="${alt}" width="${w}" style="display:block;height:auto;max-width:100%;${ta === "center" ? "margin:0 auto;" : ""}" />`
        : `<div style="width:100%;height:160px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;">Image placeholder</div>`;
      return `<tr${rowBg(block)}><td style="${pad}text-align:${ta};">
  ${block.link ? `<a href="${block.link}" style="display:block;">${inner}</a>` : inner}
</td></tr>`;
    }

    case "divider": {
      const col   = block.border_color ?? "#eeeeee";
      const thick = block.thickness ?? 1;
      const pad   = tdPad(block, 12, 40, 12);
      return `<tr${rowBg(block)}><td style="${pad}">
  <div style="border-top:${thick}px solid ${col};"></div>
</td></tr>`;
    }

    case "spacer": {
      const h = block.height ?? 24;
      return `<tr${rowBg(block)}><td style="height:${h}px;line-height:${h}px;font-size:${h}px;">&nbsp;</td></tr>`;
    }

    case "html": {
      const pad = tdPad(block, 8, 40, 8);
      const html = (block.html ?? "").replace(/<script[\s\S]*?<\/script>/gi, "");
      return `<tr${rowBg(block)}><td style="${pad}">${html}</td></tr>`;
    }

    case "footer": {
      const company = block.company ?? "Constructed Matter, Inc.";
      const address = block.address ?? "7314 E Osborn Dr Suite A - Scottsdale, AZ 85251";
      const note    = block.disclaimer ?? "If you weren't expecting this email, you can safely ignore it.";
      // Was hard-coded, so the Section padding fields silently did nothing.
      const pad = tdPad(block, 24, 40, 24);
      const rule = `padding:0 ${block.pad_right ?? block.pad_x ?? 40}px;`;
      return `<tr${rowBg(block)}><td style="${rule}"><div style="border-top:1px solid #eeeeee;"></div></td></tr>
<tr${rowBg(block)}><td style="${pad}text-align:center;">
  <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">${company}</p>
  <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">${address}</p>
  <p style="margin:16px 0 0;font-size:11px;color:#c4c4c4;">${note}</p>
</td></tr>`;
    }

    case "columns": {
      const count  = block.col_count ?? 2;
      const cols   = block.columns ?? [];
      const padT   = block.pad_top    ?? 16;
      const padL   = block.pad_left   ?? block.pad_x ?? 40;
      const padR   = block.pad_right  ?? block.pad_x ?? 40;
      const padB   = block.pad_bottom ?? 16;
      const gutter = 8;
      const colW   = count === 2 ? "50%" : count === 3 ? "33%" : "25%";

      const colTds = Array.from({ length: count }).map((_, i) => {
        const col     = cols[i];
        const isLast  = i === count - 1;
        const gutterR = isLast ? "" : `padding-right:${gutter}px;`;
        return `<td width="${colW}" valign="top" style="vertical-align:top;${gutterR}">
  ${col ? renderColumnItem(col) : `<div style="height:60px;background:#f9fafb;border:1px dashed #d1d5db;border-radius:4px;"></div>`}
</td>`;
      }).join("\n      ");

      return `<tr${rowBg(block)}><td style="padding:${padT}px ${padR}px ${padB}px ${padL}px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${colTds}
    </tr>
  </table>
</td></tr>`;
    }

    case "list": {
      const pad = tdPad(block, 8, 40, 16);
      const body = renderList({
        items: block.items,
        style: block.list_style,
        icon: block.list_icon,
        markerColor: block.marker_color,
        color: block.color,
        fontSize: block.font_size,
        spacing: block.item_spacing,
        lineHeight: block.line_height,
      });
      if (!body) return "";
      return `<tr${rowBg(block)}><td style="${pad}">
  ${body}
</td></tr>`;
    }

    default:
      return "";
  }
}

// Just the rendered block rows (no email wrapper) — used by the Print builder to
// place the same blocks inside a page-sized document instead of the 560px email.
export function blocksToInnerHtml(blocks: EmailBlock[]): string {
  return blocks.map(renderBlock).join("\n");
}

export function blocksToHtml(blocks: EmailBlock[], settings: EmailSettings = {}): string {
  const s = { ...EMAIL_DEFAULTS, ...stripEmpty(settings) };
  const rows = blocks.map(renderBlock).join("\n");
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>a{color:${s.link_color};}</style></head>
<body style="margin:0;padding:0;background-color:${s.page_bg};font-family:${s.font_family};font-size:${s.font_size}px;color:${s.text_color};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${s.page_bg};padding:${s.page_pad_y}px ${s.page_pad_x}px;">
    <tr><td align="center">
      <table width="${s.width}" cellpadding="0" cellspacing="0" style="background:${s.content_bg};border-radius:${s.corner_radius}px;overflow:hidden;max-width:${s.width}px;width:100%;font-family:${s.font_family};">
        ${rows}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Drop blanks before merging over the defaults.
 *
 * A cleared colour input sends "", and `{...defaults, page_bg: ""}` would put
 * an empty string into the markup rather than falling back.
 */
function stripEmpty(settings: EmailSettings): EmailSettings {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out as EmailSettings;
}
