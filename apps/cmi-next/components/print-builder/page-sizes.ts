// Print page sizes (inches). 96dpi is the CSS reference for on-screen px.
export type PageSizeKey = "letter" | "legal" | "tabloid" | "a4" | "half_letter" | "postcard" | "custom";
export type Orientation = "portrait" | "landscape";

export const PAGE_SIZES: Record<Exclude<PageSizeKey, "custom">, { label: string; w: number; h: number }> = {
  letter: { label: 'Letter — 8.5 × 11 in', w: 8.5, h: 11 },
  legal: { label: 'Legal — 8.5 × 14 in', w: 8.5, h: 14 },
  tabloid: { label: 'Tabloid — 11 × 17 in', w: 11, h: 17 },
  a4: { label: "A4 — 8.27 × 11.69 in", w: 8.27, h: 11.69 },
  half_letter: { label: 'Half Letter — 5.5 × 8.5 in', w: 5.5, h: 8.5 },
  postcard: { label: 'Postcard — 4 × 6 in', w: 4, h: 6 },
};

export const DPI = 96;

export function pageDims(key: PageSizeKey, orientation: Orientation, widthIn?: number | null, heightIn?: number | null) {
  let w: number, h: number;
  if (key === "custom" && widthIn && heightIn) { w = widthIn; h = heightIn; }
  else { const s = PAGE_SIZES[(key as Exclude<PageSizeKey, "custom">)] ?? PAGE_SIZES.letter; w = s.w; h = s.h; }
  if (orientation === "landscape") [w, h] = [h, w];
  return { wIn: w, hIn: h, wPx: Math.round(w * DPI), hPx: Math.round(h * DPI) };
}

export function sizeLabel(key: PageSizeKey): string {
  if (key === "custom") return "Custom";
  return PAGE_SIZES[key]?.label ?? key;
}
