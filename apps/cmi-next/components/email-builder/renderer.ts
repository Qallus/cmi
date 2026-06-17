import type { EmailBlock } from "./types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";

function align(a?: string) {
  return a === "right" ? "right" : a === "left" ? "left" : "center";
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "header": {
      const bg = block.bg_color ?? "#111111";
      const logo = block.logo_url ?? `${APP_URL}/brand/CMI_Line_Logo_White.svg`;
      const w = block.logo_width ?? 180;
      return `<tr><td style="background:${bg};padding:28px 40px;text-align:center;">
  <img src="${logo}" alt="Logo" width="${w}" style="display:block;margin:0 auto;height:auto;max-width:100%;" />
</td></tr>`;
    }

    case "heading": {
      const tag = block.level ?? "h1";
      const fs = block.font_size ?? (tag === "h1" ? 28 : tag === "h2" ? 22 : 18);
      const col = block.color ?? "#111111";
      const ta = align(block.align);
      return `<tr><td style="padding:24px 40px 8px;">
  <${tag} style="margin:0;font-size:${fs}px;font-weight:700;color:${col};line-height:1.3;text-align:${ta};">${block.text ?? "Heading"}</${tag}>
</td></tr>`;
    }

    case "text": {
      const col = block.color ?? "#4b5563";
      const fs = block.font_size ?? 15;
      const ta = align(block.align);
      return `<tr><td style="padding:8px 40px;">
  <p style="margin:0;font-size:${fs}px;color:${col};line-height:1.7;text-align:${ta};">${(block.content ?? "Your text here.").replace(/\n/g, "<br/>")}</p>
</td></tr>`;
    }

    case "button": {
      const bg = block.btn_bg ?? "#C87A3A";
      const col = block.btn_color ?? "#ffffff";
      const radius = block.btn_radius ?? 6;
      const ta = align(block.align);
      const href = block.url ?? "#";
      const label = block.label ?? "Click Here";
      return `<tr><td style="padding:16px 40px;text-align:${ta};">
  <table cellpadding="0" cellspacing="0" style="display:inline-table;">
    <tr><td style="background:${bg};border-radius:${radius}px;">
      <a href="${href}" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:700;color:${col};text-decoration:none;letter-spacing:0.04em;">${label} &rarr;</a>
    </td></tr>
  </table>
</td></tr>`;
    }

    case "image": {
      const src = block.src ?? "";
      const alt = block.alt ?? "";
      const w = block.img_width ?? 480;
      const ta = align(block.align);
      const inner = src
        ? `<img src="${src}" alt="${alt}" width="${w}" style="display:block;height:auto;max-width:100%;${ta === "center" ? "margin:0 auto;" : ""}" />`
        : `<div style="width:100%;height:160px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;">Image placeholder</div>`;
      return `<tr><td style="padding:12px 40px;text-align:${ta};">
  ${block.link ? `<a href="${block.link}" style="display:block;">${inner}</a>` : inner}
</td></tr>`;
    }

    case "divider": {
      const col = block.border_color ?? "#eeeeee";
      const thick = block.thickness ?? 1;
      return `<tr><td style="padding:12px 40px;">
  <div style="border-top:${thick}px solid ${col};"></div>
</td></tr>`;
    }

    case "spacer": {
      const h = block.height ?? 24;
      return `<tr><td style="height:${h}px;line-height:${h}px;font-size:${h}px;">&nbsp;</td></tr>`;
    }

    case "footer": {
      const company = block.company ?? "Constructed Matter, Inc.";
      const address = block.address ?? "7314 E Osborn Dr Suite A · Scottsdale, AZ 85251";
      const note = block.disclaimer ?? "If you weren't expecting this email, you can safely ignore it.";
      return `<tr><td style="padding:0 40px;"><div style="border-top:1px solid #eeeeee;"></div></td></tr>
<tr><td style="padding:24px 40px;text-align:center;">
  <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">${company}</p>
  <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">${address}</p>
  <p style="margin:16px 0 0;font-size:11px;color:#c4c4c4;">${note}</p>
</td></tr>`;
    }

    default:
      return "";
  }
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  const rows = blocks.map(renderBlock).join("\n");
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
        ${rows}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
