/* eslint-disable @typescript-eslint/no-explicit-any */
// Functions injected into the vendor page via chrome.scripting.executeScript.
// They MUST be fully self-contained (no imports / outer refs) — Chrome
// serializes them to run in the page. They run in the isolated content-script
// world, so they can read the DOM and use chrome.runtime.sendMessage.

export type Confidence = "high" | "medium" | "low";
export type ExtractResult = { fields: Record<string, string>; confidence: Record<string, Confidence> };

declare global {
  interface Window {
    __cmiPickerCleanup?: (() => void) | null;
  }
}

// --- Auto-Build: JSON-LD → OpenGraph → DOM heuristics -----------------------
export function cmiPageExtractor(): ExtractResult {
  const fields: Record<string, string> = {};
  const confidence: Record<string, Confidence> = {};
  const abs = (u: string) => {
    try {
      return new URL(u, location.href).href;
    } catch {
      return u;
    }
  };
  const setF = (k: string, v: string | null | undefined, c: Confidence) => {
    if (!fields[k] && v && String(v).trim()) {
      fields[k] = String(v).trim();
      confidence[k] = c;
    }
  };

  // 1) JSON-LD Product
  let ld: any = null;
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent || "null");
      const arr = Array.isArray(data) ? data : data && data["@graph"] ? data["@graph"] : [data];
      for (const node of arr) {
        if (!node || !node["@type"]) continue;
        const types = (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]).map((x: any) =>
          String(x).toLowerCase(),
        );
        if (types.includes("product")) {
          ld = node;
          break;
        }
      }
      if (ld) break;
    } catch {
      /* ignore malformed ld+json */
    }
  }
  if (ld) {
    setF("title", ld.name, "high");
    setF("sku", ld.sku, "high");
    setF("model_number", ld.mpn, "high");
    setF("short_description", ld.description, "high");
    const brand = ld.brand && (typeof ld.brand === "object" ? ld.brand.name : ld.brand);
    setF("vendor_name", brand, "high");
    let img = ld.image;
    if (Array.isArray(img)) img = img[0];
    if (img && typeof img === "object") img = img.url || img.contentUrl;
    if (img) setF("image_url", abs(String(img)), "high");
    let offers = ld.offers;
    if (Array.isArray(offers)) offers = offers[0];
    if (offers) setF("price", offers.price || offers.lowPrice, "high");
  }

  // 2) OpenGraph / meta
  const meta = (p: string) => {
    const el = document.querySelector(`meta[property="${p}"], meta[name="${p}"]`);
    return el ? el.getAttribute("content") : null;
  };
  setF("title", meta("og:title"), "medium");
  setF("image_url", meta("og:image") ? abs(meta("og:image")!) : null, "medium");
  setF("short_description", meta("og:description") || meta("description"), "medium");
  setF("price", meta("product:price:amount"), "medium");
  setF("vendor_name", meta("og:site_name"), "low");

  // 3) DOM heuristics
  const h1 = document.querySelector("h1") as HTMLElement | null;
  if (h1) setF("title", h1.innerText, "low");
  if (!fields.image_url) {
    let best: HTMLImageElement | null = null;
    let bestArea = 0;
    for (const im of Array.from(document.images)) {
      const r = im.getBoundingClientRect();
      const area = r.width * r.height;
      if (r.top < window.innerHeight * 1.5 && area > bestArea && (im.currentSrc || im.src)) {
        bestArea = area;
        best = im;
      }
    }
    if (best) setF("image_url", abs(best.currentSrc || best.src), "low");
  }
  if (!fields.price) {
    const m = (document.body.innerText || "").match(/\$\s?[\d,]+(?:\.\d{2})?/);
    if (m) setF("price", m[0].replace(/[^\d.]/g, ""), "low");
  }

  // Always-known fields
  fields.source_url = location.href;
  if (!fields.vendor_name) {
    fields.vendor_name = location.hostname.replace(/^www\./, "");
    confidence.vendor_name = "low";
  }
  // Normalize price to a bare number where possible
  if (fields.price) fields.price = String(fields.price).replace(/[^\d.]/g, "");

  return { fields, confidence };
}

// --- Element picker: one-shot hover-highlight + click-to-capture ------------
export function cmiElementPicker(fieldKey: string): void {
  if (window.__cmiPickerCleanup) {
    try {
      window.__cmiPickerCleanup();
    } catch {
      /* noop */
    }
  }
  const abs = (u: string) => {
    try {
      return new URL(u, location.href).href;
    } catch {
      return u;
    }
  };
  const kind = fieldKey === "image_url" ? "image" : fieldKey === "price" ? "price" : "text";

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #C87A3A;background:rgba(200,122,58,0.15);border-radius:3px;display:none;";
  const label = document.createElement("div");
  label.style.cssText =
    "position:fixed;z-index:2147483647;pointer-events:none;background:#141210;color:#fff;font:600 12px system-ui,sans-serif;padding:5px 9px;border-radius:6px;top:10px;left:10px;box-shadow:0 2px 8px rgba(0,0,0,.3);";
  label.textContent = `Click the ${kind} · Esc to cancel`;
  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(label);

  let current: Element | null = null;

  const resolveImage = (el: Element): string | null => {
    const asImg = el as HTMLImageElement;
    if (el.tagName === "IMG") return asImg.currentSrc || asImg.src || el.getAttribute("data-src");
    const inner = el.querySelector?.("img") as HTMLImageElement | null;
    if (inner) return inner.currentSrc || inner.src;
    const bg = getComputedStyle(el as HTMLElement).backgroundImage;
    const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
    if (m) return m[1];
    const up = el.closest?.("picture, a, figure, div");
    const img2 = up?.querySelector?.("img") as HTMLImageElement | null;
    if (img2) return img2.currentSrc || img2.src;
    return null;
  };

  const capture = (el: Element): string => {
    if (kind === "image") {
      const src = resolveImage(el);
      return src ? abs(src) : "";
    }
    const text = ((el as HTMLElement).innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    if (kind === "price") {
      const m = text.match(/[\d,]+(?:\.\d{2})?/);
      return m ? m[0].replace(/,/g, "") : text;
    }
    return text;
  };

  const move = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay || el === label) return;
    current = el;
    const r = el.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.top = r.top + "px";
    overlay.style.left = r.left + "px";
    overlay.style.width = r.width + "px";
    overlay.style.height = r.height + "px";
  };
  const cleanup = () => {
    document.removeEventListener("mousemove", move, true);
    document.removeEventListener("click", click, true);
    document.removeEventListener("keydown", key, true);
    overlay.remove();
    label.remove();
    window.__cmiPickerCleanup = null;
  };
  const click = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = current || document.elementFromPoint(e.clientX, e.clientY);
    const value = el ? capture(el) : "";
    chrome.runtime.sendMessage({ type: "CMI_PICK", field: fieldKey, value });
    cleanup();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      chrome.runtime.sendMessage({ type: "CMI_PICK_CANCEL" });
      cleanup();
    }
  };

  document.addEventListener("mousemove", move, true);
  document.addEventListener("click", click, true);
  document.addEventListener("keydown", key, true);
  window.__cmiPickerCleanup = cleanup;
}
