// Render the email hero backgrounds for each invitation theme:
//   public/events/themes/<id>.gif  (animated, loops seamlessly)
//   public/events/themes/<id>.png  (still fallback)
//
// Email clients don't run JavaScript or canvas, so the web page's live
// animation (lib/events/hero-script.ts) can't go in an email. These are the
// same looks drawn as SVG frames and encoded with sharp (already in the
// dependency tree via Next). Deterministic: a fixed seed per theme.
//
// Run once after changing a theme, from apps/cmi-next:
//   node scripts/render-theme-gifs.mjs
// The output is committed.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { EVENT_THEMES } from "../lib/events/themes.ts";

const W = 600;
const H = 300;
const FRAMES = 30;
const DELAY = 70; // ms per frame → a 2.1 s loop
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "events", "themes");
const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function gradientDef(css) {
  const stops = [...css.matchAll(/(#[0-9a-f]{3,8})\s*(\d+)?%?/gi)].map((m, i, all) => ({
    color: m[1],
    at: m[2] !== undefined ? Number(m[2]) : (i / Math.max(1, all.length - 1)) * 100,
  }));
  if (stops.length <= 1) return { fill: stops[0]?.color ?? "#111111", defs: "" };
  const angle = Number(css.match(/(\d+)deg/)?.[1] ?? 180);
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(rad) / 2, y = Math.sin(rad) / 2;
  const defs = `<linearGradient id="bg" x1="${0.5 - x}" y1="${0.5 - y}" x2="${0.5 + x}" y2="${0.5 + y}">${stops
    .map((s) => `<stop offset="${s.at}%" stop-color="${s.color}"/>`)
    .join("")}</linearGradient>`;
  return { fill: "url(#bg)", defs };
}

function particles(theme) {
  const r = rng([...theme.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const colors = [theme.accent, ...theme.stripe];
  const pick = () => colors[Math.floor(r() * colors.length)];
  const list = [];
  const n = { snow: 85, confetti: 60, bokeh: 18, fireworks: 2, blueprint: 0, none: 0 }[theme.animation] ?? 0;
  for (let i = 0; i < n; i++) {
    list.push({
      x: r() * W, y: r() * H, size: r(), a: 0.3 + r() * 0.6, phase: r(),
      laps: 1 + Math.floor(r() * 2), sway: 4 + r() * 10, spin: 1 + Math.floor(r() * 2), color: pick(), star: r() < 0.1,
    });
  }
  return list;
}

function frameSvg(theme, ps, f /* 0..1 */) {
  const bg = gradientDef(theme.heroBg);
  const parts = [];
  const defs = [bg.defs];
  switch (theme.animation) {
    case "snow":
      for (const p of ps) {
        const y = (p.y + p.laps * H * f) % H;
        const x = p.x + p.sway * Math.sin(TAU * (f + p.phase));
        const rr = 0.8 + p.size * 1.9;
        if (p.star) {
          const s = rr * 3.2;
          for (let k = 0; k < 3; k++) {
            const ang = (k * Math.PI) / 3 + TAU * f;
            parts.push(`<line x1="${x - Math.cos(ang) * s}" y1="${y - Math.sin(ang) * s}" x2="${x + Math.cos(ang) * s}" y2="${y + Math.sin(ang) * s}" stroke="#fff" stroke-opacity="${p.a}" stroke-width="1"/>`);
          }
        } else {
          parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(2)}" fill="#fff" fill-opacity="${p.a.toFixed(2)}"/>`);
        }
      }
      break;
    case "confetti":
      for (const p of ps) {
        const y = ((p.y + p.laps * (H + 20) * f) % (H + 20)) - 10;
        const x = p.x + p.sway * Math.sin(TAU * (f + p.phase));
        const rot = (p.phase * 360 + 360 * p.spin * f).toFixed(1);
        const w = 4 + p.size * 6;
        parts.push(`<rect x="${(-w / 2).toFixed(1)}" y="-2" width="${w.toFixed(1)}" height="4" fill="${p.color}" opacity="0.9" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})"/>`);
      }
      break;
    case "bokeh":
      ps.forEach((p, i) => {
        defs.push(`<radialGradient id="b${i}"><stop offset="0%" stop-color="${p.color}" stop-opacity="1"/><stop offset="100%" stop-color="${p.color}" stop-opacity="0"/></radialGradient>`);
        const rr = 10 + p.size * 30;
        const y = (((p.y - p.laps * (H + 2 * rr) * f) % (H + 2 * rr)) + (H + 2 * rr)) % (H + 2 * rr) - rr;
        const op = (0.12 + p.a * 0.2) * (0.75 + 0.25 * Math.sin(TAU * (f + p.phase)));
        parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" fill="url(#b${i})" opacity="${op.toFixed(2)}"/>`);
      });
      break;
    case "fireworks":
      ps.forEach((p, i) => {
        const local = (f + i / ps.length) % 1; // each burst at its own time in the loop
        const cx = W * (0.25 + 0.5 * p.x / W), cy = H * (0.25 + 0.25 * p.y / H);
        const radius = 12 + 90 * Math.sqrt(local);
        const op = Math.max(0, 1 - local * 1.15);
        for (let k = 0; k < 36; k++) {
          const ang = (k / 36) * TAU;
          const px = cx + Math.cos(ang) * radius, py = cy + Math.sin(ang) * radius + 30 * local * local;
          parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1.6" fill="${p.color}" opacity="${op.toFixed(2)}"/>`);
        }
      });
      break;
    case "blueprint": {
      const g = 30, off = g * f; // one cell per loop, so it wraps cleanly
      for (let x = -g + off, i = 0; x < W + g; x += g, i++) parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#a9c3da" stroke-opacity="${i % 5 === 0 ? 0.16 : 0.07}"/>`);
      for (let y = -g + off, i = 0; y < H + g; y += g, i++) parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#a9c3da" stroke-opacity="${i % 5 === 0 ? 0.16 : 0.07}"/>`);
      const len = W * 0.45 * Math.min(1, f * 1.6), al = f < 0.8 ? 0.55 : 0.55 * (1 - (f - 0.8) / 0.2);
      parts.push(`<g stroke="${theme.accent}" stroke-opacity="${al.toFixed(2)}"><line x1="${W * 0.5}" y1="${H * 0.82}" x2="${W * 0.5 + len}" y2="${H * 0.82}"/><line x1="${W * 0.5}" y1="${H * 0.82 - 6}" x2="${W * 0.5}" y2="${H * 0.82 + 6}"/></g>`);
      break;
    }
    default:
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${defs.join("")}</defs><rect width="${W}" height="${H}" fill="${bg.fill}"/>${parts.join("")}</svg>`;
}

async function raster(svg) {
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
}

mkdirSync(OUT, { recursive: true });
for (const theme of EVENT_THEMES) {
  const ps = particles(theme);
  const still = theme.animation === "fireworks" ? 0.25 : 0;
  writeFileSync(join(OUT, `${theme.id}.png`), await sharp(Buffer.from(frameSvg(theme, ps, still))).png({ compressionLevel: 9 }).toBuffer());

  const count = theme.animation === "none" ? 1 : FRAMES;
  const frames = [];
  for (let i = 0; i < count; i++) frames.push(await raster(frameSvg(theme, ps, i / count)));
  const gif = await sharp(Buffer.concat(frames), { raw: { width: W, height: H * count, channels: 4, pageHeight: H } })
    .gif({ loop: 0, delay: Array(count).fill(DELAY), colours: 96, dither: 0.3, effort: 8 })
    .toBuffer();
  writeFileSync(join(OUT, `${theme.id}.gif`), gif);
  console.log(`${theme.id}: gif ${(gif.length / 1024).toFixed(0)} KB, ${count} frame(s)`);
}
