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
    if (!active) return;
    const target = e.target as Element | null;
    if (!target) return;
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
  }

  doc.addEventListener("mousemove", onMove, true);
  doc.addEventListener("click", onClick, true);
  win.addEventListener("scroll", reposition, true);
  win.addEventListener("resize", reposition);

  return {
    setMode(m) { mode = m; hoverBox.style.display = "none"; },
    setActive(a) { active = a; if (!a) hoverBox.style.display = "none"; },
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
      hoverBox.remove(); selBox.remove();
      refMap.clear();
    },
  };
}
