// Same-origin review overlay for the Live Page Editor.
//
// Runs in the PARENT realm but operates on the iframe's Document/Window (safe
// because the previewed page is a same-origin Next.js route). It highlights the
// element under the cursor for the active selection mode, captures clicks
// (suppressing navigation), builds a stable descriptor for the chosen element,
// and reports headings/sections as a page outline.
import type { ElementDescriptor, SelectionMode } from "@/lib/live-editor/types";

export type OutlineItem = { element_ref: string; type: string; label: string; level: number | null };

export type OverlayHandlers = {
  slug: string;
  mode: SelectionMode;
  active: boolean;
  onSelect: (desc: ElementDescriptor) => void;
  onOverlap: (candidates: ElementDescriptor[], clientX: number, clientY: number) => void;
  onOutline: (items: OutlineItem[]) => void;
};

export type OverlayController = {
  setMode: (mode: SelectionMode) => void;
  setActive: (active: boolean) => void;
  setInsertMode: (on: boolean) => void;
  selectByRef: (ref: string) => ElementDescriptor | null;
  clearSelection: () => void;
  scanOutline: () => void;
  destroy: () => void;
};

const MEANINGFUL = ["section", "container", "row", "column", "card", "component", "form"];

function getClass(el: Element): string {
  const c = (el as HTMLElement).className;
  return typeof c === "string" ? c.toLowerCase() : "";
}

function classify(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return tag;
  const cls = getClass(el);
  if (["section", "header", "footer", "main"].includes(tag) || /\bsection\b/.test(cls)) return "section";
  if (tag === "form") return "form";
  if (tag === "nav") return "component";
  const role = el.getAttribute("role");
  if (tag === "button" || (tag === "a" && (role === "button" || /\bbtn\b|button/.test(cls)))) return "component";
  if (/container|wrapper/.test(cls)) return "container";
  if (/\brow\b|\bgrid\b/.test(cls)) return "row";
  if (/\bcol(-|\b)/.test(cls)) return "column";
  if (/\bcard\b/.test(cls)) return "card";
  if (/\bbtn\b|button/.test(cls)) return "component";
  return tag;
}

function isMeaningful(el: Element): boolean {
  const t = classify(el);
  return /^h[1-6]$/.test(t) || MEANINGFUL.includes(t);
}

function matchesMode(el: Element, mode: SelectionMode): boolean {
  const t = classify(el);
  switch (mode) {
    case "headings": return /^h[1-6]$/.test(t);
    case "sections": return t === "section";
    case "containers": return t === "container";
    case "rows": return t === "row";
    case "columns": return t === "column";
    case "cards": return t === "card";
    case "components": return t === "component" || t === "form";
    case "auto": default: return isMeaningful(el);
  }
}

function domIndexPath(el: Element, doc: Document): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== doc.body && node.parentElement) {
    const par: HTMLElement = node.parentElement!;
    const i = Array.prototype.indexOf.call(par.children, node);
    parts.unshift(`${node.tagName.toLowerCase()}[${i}]`);
    node = par;
  }
  return parts.join("/");
}

function domPath(el: Element): string {
  const tags: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node.tagName && node.tagName.toLowerCase() !== "html" && depth < 12) {
    tags.unshift(node.tagName.toLowerCase());
    node = node.parentElement; depth++;
  }
  return tags.join(">");
}

function nthOfType(el: Element): number {
  let i = 1; let sib = el.previousElementSibling;
  while (sib) { if (sib.tagName === el.tagName) i++; sib = sib.previousElementSibling; }
  return i;
}

function cssSelector(el: Element, doc: Document): string {
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node !== doc.body && node.parentElement && depth < 8) {
    if (node.id) { parts.unshift(`#${node.id}`); break; }
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${nthOfType(node)})`);
    node = node.parentElement; depth++;
  }
  return parts.join(" > ");
}

function textOf(el: Element, max = 120): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sectionLabel(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.slice(0, 60);
  const heading = el.querySelector("h1,h2,h3,h4,h5,h6");
  if (heading) return textOf(heading, 60) || "Section";
  if (el.id) return el.id;
  const cls = (el as HTMLElement).className;
  if (typeof cls === "string" && cls.trim()) return cls.trim().split(/\s+/)[0];
  return el.tagName.toLowerCase();
}

function nearestSection(el: Element): Element | null {
  let node: Element | null = el;
  while (node && node !== node.ownerDocument?.body) {
    if (classify(node) === "section" && node !== el) return node;
    node = node.parentElement;
  }
  return null;
}

export function installOverlay(doc: Document, win: Window, handlers: OverlayHandlers): OverlayController {
  let mode = handlers.mode;
  let active = handlers.active;
  const refMap = new Map<string, HTMLElement>();

  // Highlight boxes live inside the iframe document, positioned in document space.
  const hoverBox = doc.createElement("div");
  const selBox = doc.createElement("div");
  const baseBox = "position:absolute;pointer-events:none;z-index:2147483646;box-sizing:border-box;transition:all .04s linear;border-radius:2px;";
  hoverBox.style.cssText = baseBox + "border:2px solid #6366f1;background:rgba(99,102,241,.12);display:none;";
  selBox.style.cssText = baseBox + "border:2px solid #16a34a;background:rgba(22,163,74,.10);display:none;";
  const label = doc.createElement("div");
  label.style.cssText = "position:absolute;top:-18px;left:0;background:#6366f1;color:#fff;font:600 10px/16px system-ui,sans-serif;padding:0 6px;border-radius:3px;white-space:nowrap;";
  hoverBox.appendChild(label);
  const attach = () => { if (doc.body) { doc.body.appendChild(hoverBox); doc.body.appendChild(selBox); } };
  attach();

  let selectedEl: HTMLElement | null = null;

  // --- Insert-section markers (the "+" between top-level sections) ---
  let insertMode = false;
  type Marker = { el: HTMLElement; after: Element | null; before: Element | null; anchor: Element; edge: "top" | "bottom" };
  let markers: Marker[] = [];

  function clearMarkers() { for (const m of markers) m.el.remove(); markers = []; }

  function topLevelSections(): HTMLElement[] {
    let els = Array.from(doc.querySelectorAll<HTMLElement>("section"));
    if (els.length === 0) els = Array.from(doc.querySelectorAll<HTMLElement>("main > div")).slice(0, 24);
    const outer = els.filter((e) => !els.some((o) => o !== e && o.contains(e)));
    outer.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return outer.filter((e) => e.getBoundingClientRect().height > 40);
  }

  function makeMarker(after: Element | null, before: Element | null, anchor: Element, edge: "top" | "bottom"): Marker {
    const el = doc.createElement("button");
    el.setAttribute("data-lpe-insert", "1");
    el.type = "button";
    el.textContent = "+ Add content here";
    el.style.cssText = "position:absolute;z-index:2147483645;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;border:1px dashed #C87A3A;background:#fff;color:#C87A3A;font:600 11px/1 system-ui,sans-serif;padding:6px 10px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.15);opacity:.9;";
    el.addEventListener("mouseenter", () => { el.style.background = "#C87A3A"; el.style.color = "#fff"; });
    el.addEventListener("mouseleave", () => { el.style.background = "#fff"; el.style.color = "#C87A3A"; });
    doc.body.appendChild(el);
    return { el, after, before, anchor, edge };
  }

  function positionMarker(m: Marker) {
    const r = m.anchor.getBoundingClientRect();
    m.el.style.left = `${r.left + r.width / 2 + win.scrollX}px`;
    m.el.style.top = `${(m.edge === "top" ? r.top : r.bottom) + win.scrollY}px`;
  }

  function renderMarkers() {
    clearMarkers();
    if (!insertMode) return;
    const sections = topLevelSections();
    if (sections.length === 0) return;
    for (let i = 0; i < sections.length; i++) {
      markers.push(makeMarker(i > 0 ? sections[i - 1] : null, sections[i], sections[i], "top"));
    }
    const last = sections[sections.length - 1];
    markers.push(makeMarker(last, null, last, "bottom"));
    markers.forEach(positionMarker);
  }

  function buildInsertDescriptor(after: Element | null, before: Element | null): ElementDescriptor {
    const afterLabel = after ? sectionLabel(after) : "top of page";
    const beforeLabel = before ? sectionLabel(before) : "bottom of page";
    const afterRef = after ? domIndexPath(after, doc) : "start";
    const beforeRef = before ? domIndexPath(before, doc) : "end";
    const anchor = before ?? after;
    const r = anchor ? anchor.getBoundingClientRect() : null;
    return {
      element_ref: `${handlers.slug}::insert::${afterRef}__${beforeRef}`,
      element_type: "section_insert",
      element_label: `Insert between “${afterLabel}” and “${beforeLabel}”`,
      heading_text: null,
      heading_level: null,
      section_order: null,
      parent_section_label: afterLabel,
      dom_selector: null,
      dom_path: null,
      css_classes: null,
      component_name: null,
      content_summary: `New content requested between "${afterLabel}" and "${beforeLabel}".`,
      bounding_box: r ? { x: Math.round(r.left + win.scrollX), y: Math.round(r.top + win.scrollY), width: Math.round(r.width), height: 0 } : null,
    };
  }

  function place(box: HTMLElement, el: Element) {
    const r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = `${r.left + win.scrollX}px`;
    box.style.top = `${r.top + win.scrollY}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  }

  function buildDescriptor(el: Element): ElementDescriptor {
    const type = classify(el);
    const isHeading = /^h[1-6]$/.test(type);
    const headingText = isHeading ? textOf(el, 160) : null;
    const section = nearestSection(el);
    const allSections = Array.from(doc.querySelectorAll("section, header, footer, main"));
    const sectionOrder = section ? allSections.indexOf(section) : (type === "section" ? allSections.indexOf(el) : null);
    const clsRaw = (el as HTMLElement).className;
    const cls = typeof clsRaw === "string" ? clsRaw : "";
    const refText = isHeading && headingText ? `::${headingText.slice(0, 60)}` : "";
    const element_ref = `${handlers.slug}::${type}::${domIndexPath(el, doc)}${refText}`;
    refMap.set(element_ref, el as HTMLElement);

    let elementLabel: string;
    if (isHeading) elementLabel = headingText || `${type.toUpperCase()} heading`;
    else if (type === "section") elementLabel = sectionLabel(el);
    else elementLabel = textOf(el, 48) || `${type}${cls ? " ." + cls.trim().split(/\s+/)[0] : ""}`;

    const r = el.getBoundingClientRect();
    return {
      element_ref,
      element_type: type,
      element_label: elementLabel,
      heading_text: headingText,
      heading_level: isHeading ? Number(type[1]) : null,
      section_order: sectionOrder,
      parent_section_label: section ? sectionLabel(section) : (type === "section" ? sectionLabel(el) : null),
      dom_selector: cssSelector(el, doc),
      dom_path: domPath(el),
      css_classes: cls || null,
      component_name: type === "component" ? (el.tagName.toLowerCase() === "a" ? "link/button" : el.tagName.toLowerCase()) : null,
      content_summary: textOf(el, 160) || null,
      bounding_box: { x: Math.round(r.left + win.scrollX), y: Math.round(r.top + win.scrollY), width: Math.round(r.width), height: Math.round(r.height) },
    };
  }

  function candidateFor(target: Element): Element | null {
    let node: Element | null = target;
    while (node && node !== doc.body) {
      if (matchesMode(node, mode)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function overlapCandidates(target: Element): Element[] {
    const out: Element[] = [];
    const seenTypes = new Set<string>();
    let node: Element | null = target;
    while (node && node !== doc.body && out.length < 6) {
      if (isMeaningful(node)) {
        const t = classify(node);
        if (!seenTypes.has(t)) { seenTypes.add(t); out.push(node); }
      }
      node = node.parentElement;
    }
    return out;
  }

  let rafPending = false;
  function onMove(e: MouseEvent) {
    if (insertMode) { hoverBox.style.display = "none"; return; }
    if (!active) return;
    if (rafPending) return;
    rafPending = true;
    win.requestAnimationFrame(() => {
      rafPending = false;
      const target = e.target as Element | null;
      if (!target || target === hoverBox || target === selBox) { hoverBox.style.display = "none"; return; }
      const cand = candidateFor(target);
      if (!cand) { hoverBox.style.display = "none"; return; }
      place(hoverBox, cand);
      label.textContent = classify(cand).toUpperCase();
    });
  }

  function onClick(e: MouseEvent) {
    const target = e.target as Element | null;
    if (!target) return;

    // Insert markers take priority and work regardless of select mode.
    const insEl = (target as HTMLElement).closest?.("[data-lpe-insert]") as HTMLElement | null;
    if (insEl) {
      e.preventDefault(); e.stopPropagation();
      const m = markers.find((mk) => mk.el === insEl);
      if (m) handlers.onSelect(buildInsertDescriptor(m.after, m.before));
      return;
    }
    if (insertMode) { e.preventDefault(); e.stopPropagation(); return; }
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();

    if (mode === "auto") {
      const cands = overlapCandidates(target);
      if (cands.length === 0) return;
      if (cands.length === 1) {
        const desc = buildDescriptor(cands[0]);
        selectedEl = cands[0] as HTMLElement; place(selBox, cands[0]);
        handlers.onSelect(desc);
      } else {
        const descs = cands.map((c) => buildDescriptor(c));
        handlers.onOverlap(descs, e.clientX, e.clientY);
      }
      return;
    }

    const cand = candidateFor(target);
    if (!cand) return;
    const desc = buildDescriptor(cand);
    selectedEl = cand as HTMLElement; place(selBox, cand);
    handlers.onSelect(desc);
  }

  function reposition() {
    if (selectedEl && doc.body.contains(selectedEl)) place(selBox, selectedEl);
    else selBox.style.display = "none";
    if (insertMode) markers.forEach(positionMarker);
  }

  doc.addEventListener("mousemove", onMove, true);
  doc.addEventListener("click", onClick, true);
  win.addEventListener("scroll", reposition, true);
  win.addEventListener("resize", reposition);

  return {
    setMode(m) { mode = m; hoverBox.style.display = "none"; },
    setActive(a) { active = a; if (!a) hoverBox.style.display = "none"; },
    setInsertMode(on) { insertMode = on; hoverBox.style.display = "none"; renderMarkers(); },
    selectByRef(ref) {
      const el = refMap.get(ref);
      if (!el || !doc.body.contains(el)) return null;
      const desc = buildDescriptor(el);
      selectedEl = el; place(selBox, el);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return desc;
    },
    clearSelection() { selectedEl = null; selBox.style.display = "none"; },
    scanOutline() {
      const items: OutlineItem[] = [];
      const headings = Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"));
      const sections = Array.from(doc.querySelectorAll("section, header, main"));
      const collected: Element[] = [];
      // Interleave sections + headings in document order for a readable outline.
      Array.from(doc.querySelectorAll("section, header, main, h1, h2, h3, h4, h5, h6")).forEach((el) => {
        if (headings.includes(el) || sections.includes(el)) collected.push(el);
      });
      for (const el of collected.slice(0, 60)) {
        const desc = buildDescriptor(el);
        const t = classify(el);
        items.push({
          element_ref: desc.element_ref,
          type: t,
          label: desc.element_label || sectionLabel(el),
          level: /^h[1-6]$/.test(t) ? Number(t[1]) : null,
        });
      }
      handlers.onOutline(items);
    },
    destroy() {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("click", onClick, true);
      win.removeEventListener("scroll", reposition, true);
      win.removeEventListener("resize", reposition);
      clearMarkers();
      hoverBox.remove(); selBox.remove();
      refMap.clear();
    },
  };
}
