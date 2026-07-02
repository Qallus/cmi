# Frontend Page Editor — Portable Spec & Implementation Prompt

A self-contained, framework-agnostic guide to the **in-iframe visual selection
engine** built for the CMI Live Page Editor
(`/dashboard/site-content/live-editor`). It lets an end-user load a frontend page
in an iframe and **click text, headings, sections, rows, columns, cards, and
components** to select them, build stable references, and attach notes.

This document is written so you can hand it (or the prompt at the bottom) to
another project / AI coding agent and reproduce the feature independently. It has
**no dependency on CMI's stack** (Supabase, roles, Next.js) — those are just the
host we happened to build it in.

---

## 1. What it does

- Loads a chosen frontend page inside an `<iframe>`.
- Injects a lightweight **review overlay** into the iframe that:
  - highlights the element under the cursor for the active **selection mode**,
  - captures clicks (suppressing navigation while selecting),
  - builds a **stable element reference** + descriptor for the clicked element,
  - reports a **page outline** (headings + sections), and
  - (optionally) shows **“+ insert” markers between sections** for "add content
    here" requests.
- Hands each selection back to the host UI, which shows an inspector / note form.

It is **review-first**: it never mutates the previewed page. Selection is
read-only DOM inspection.

---

## 2. The core decision: same-origin iframe

The single most important architectural choice: **the previewed pages must be
served from the same origin as the editor.** When they are, the parent window can
read `iframe.contentDocument` directly and attach event listeners to the iframe's
DOM. No proxy, no screenshot, no re-rendering from a CMS model.

```
editor:   https://app.example.com/dashboard/site-content/live-editor
iframe:   https://app.example.com/about        ← same origin ✅ full DOM access
iframe:   https://marketing.example.com/about   ← cross-origin ❌ DOM blocked
```

If you cannot guarantee same-origin, use one of these fallbacks (in order of
preference):

1. **Same-app preview route** — render the public pages from the same app/origin
   as the editor (what CMI does).
2. **Cooperating script + `postMessage`** — ship the overlay as a script the
   previewed site loads only in authenticated preview sessions; it talks to the
   parent via `window.postMessage`. The descriptor shape below is already
   `postMessage`-friendly, so this is a drop-in evolution.
3. **Server-rendered section map** — if you can't script the page at all, generate
   the outline server-side from the page's markup/CMS blocks and render clickable
   overlays positioned from a server-provided bounding-box map (lower fidelity).

**Host requirement:** the app serving the iframe pages must allow same-origin
framing. Set headers on those routes:

```
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: frame-ancestors 'self'
```

(A global `X-Frame-Options: DENY` will make the iframe show "refused to connect"
even for your own pages — this is the #1 gotcha.)

---

## 3. Data flow

```
[Host editor UI]
  │  sets iframe.src = "/about?_nonce=…"
  ▼
[iframe loads same-origin page]
  │  onLoad → parent reads iframe.contentDocument
  ▼
[installOverlay(doc, win, handlers)]  ← runs in PARENT realm, operates on iframe DOM
  │  mousemove → highlight candidate for current mode
  │  click     → build descriptor → handlers.onSelect(descriptor)
  │  auto+overlap → handlers.onOverlap([descriptors], x, y)  (level picker)
  │  scan      → handlers.onOutline([outline items])
  ▼
[Host UI] renders inspector / note form from the descriptor
```

The overlay returns a **controller** the host uses to drive it:
`setMode`, `setActive`, `setInsertMode`, `selectByRef`, `clearSelection`,
`scanOutline`, `destroy`.

---

## 4. Element descriptor (the contract)

Every selection produces this object. It's the stable interface between the
overlay and any host UI / backend:

```ts
type ElementDescriptor = {
  element_ref: string;          // stable id, see §6
  element_type: string;         // "h1".."h6" | section | container | row | column | card | component | form | section_insert
  element_label: string;        // heading text or a friendly label
  heading_text: string | null;
  heading_level: number | null; // 1..6
  section_order: number | null; // index among page sections
  parent_section_label: string | null;
  dom_selector: string | null;  // nth-of-type CSS path
  dom_path: string | null;      // tag chain e.g. "body>main>section>h1"
  css_classes: string | null;
  component_name: string | null;
  content_summary: string | null;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
};
```

---

## 5. Selection modes

A dropdown drives what the overlay will highlight/select:

`Auto Detect` · `Sections` · `Containers` · `Rows` · `Columns` · `Cards` ·
`Components` · `Headings Only`

- In every mode except Auto, hovering finds the **nearest ancestor** that matches
  the mode and highlights it.
- In **Auto Detect**, a click that has several candidate levels under the cursor
  shows a small **picker** (Section / Container / Heading / …) so the user chooses
  the exact level.

Classification is heuristic (tag + class name):

| type       | matches |
|------------|---------|
| `h1..h6`   | heading tags |
| `section`  | `section, header, footer, main`, or class contains `section` |
| `form`     | `form` |
| `component`| `button`, `a[role=button]`, `nav`, class has `btn`/`button` |
| `container`| class has `container`/`wrapper` |
| `row`      | class has `row`/`grid` |
| `column`   | class has `col` |
| `card`     | class has `card` |

Tune this table to your design system (e.g. Tailwind, Bootstrap, a component lib).

---

## 6. Stable element references

Notes must re-attach on the next visit, so each element gets a deterministic
`element_ref`:

```
<page_slug>::<element_type>::<dom index path>[::<heading text, ≤60 chars>]
```

- `dom index path` = chain of `tag[childIndex]` from `<body>` down, e.g.
  `main[1]/section[2]/div[0]/h2[0]`. Deterministic and unique within a page.
- Heading text is appended for headings to survive minor DOM reordering.

This is intentionally structural (not relying on `id`s, which many pages lack).

---

## 7. Portable overlay engine (drop-in, zero dependencies)

Vanilla TypeScript. Operates on a same-origin `Document`/`Window`. Copy this into
the new project as `overlay.ts` and adapt `classify()` to your markup.

```ts
export type Pt = { x: number; y: number };
export type ElementDescriptor = {
  element_ref: string; element_type: string; element_label: string;
  heading_text: string | null; heading_level: number | null; section_order: number | null;
  parent_section_label: string | null; dom_selector: string | null; dom_path: string | null;
  css_classes: string | null; component_name: string | null; content_summary: string | null;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
};
export type SelectionMode =
  | "auto" | "sections" | "containers" | "rows" | "columns" | "cards" | "components" | "headings";
export type OutlineItem = { element_ref: string; type: string; label: string; level: number | null };

export type OverlayHandlers = {
  slug: string;
  mode: SelectionMode;
  active: boolean;
  onSelect: (d: ElementDescriptor) => void;
  onOverlap: (candidates: ElementDescriptor[], clientX: number, clientY: number) => void;
  onOutline: (items: OutlineItem[]) => void;
};
export type OverlayController = {
  setMode: (m: SelectionMode) => void;
  setActive: (a: boolean) => void;
  selectByRef: (ref: string) => ElementDescriptor | null;
  clearSelection: () => void;
  scanOutline: () => void;
  destroy: () => void;
};

const MEANINGFUL = ["section", "container", "row", "column", "card", "component", "form"];
const getClass = (el: Element) => (typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className.toLowerCase() : "");

// ── Adapt this to your design system ────────────────────────────────────────
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
// ────────────────────────────────────────────────────────────────────────────

const isMeaningful = (el: Element) => { const t = classify(el); return /^h[1-6]$/.test(t) || MEANINGFUL.includes(t); };

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
    default: return isMeaningful(el); // auto
  }
}

function domIndexPath(el: Element, doc: Document): string {
  const parts: string[] = []; let node: Element | null = el;
  while (node && node !== doc.body && node.parentElement) {
    const par: HTMLElement = node.parentElement;
    parts.unshift(`${node.tagName.toLowerCase()}[${Array.prototype.indexOf.call(par.children, node)}]`);
    node = par;
  }
  return parts.join("/");
}
function domPath(el: Element): string {
  const tags: string[] = []; let node: Element | null = el; let d = 0;
  while (node && node.tagName && node.tagName.toLowerCase() !== "html" && d < 12) { tags.unshift(node.tagName.toLowerCase()); node = node.parentElement; d++; }
  return tags.join(">");
}
function nthOfType(el: Element): number { let i = 1, s = el.previousElementSibling; while (s) { if (s.tagName === el.tagName) i++; s = s.previousElementSibling; } return i; }
function cssSelector(el: Element, doc: Document): string {
  const parts: string[] = []; let node: Element | null = el; let d = 0;
  while (node && node !== doc.body && node.parentElement && d < 8) {
    if (node.id) { parts.unshift(`#${node.id}`); break; }
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${nthOfType(node)})`); node = node.parentElement; d++;
  }
  return parts.join(" > ");
}
const textOf = (el: Element, max = 120) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, max);
function sectionLabel(el: Element): string {
  const aria = el.getAttribute("aria-label"); if (aria) return aria.slice(0, 60);
  const h = el.querySelector("h1,h2,h3,h4,h5,h6"); if (h) return textOf(h, 60) || "Section";
  if (el.id) return el.id;
  const cls = (el as HTMLElement).className; if (typeof cls === "string" && cls.trim()) return cls.trim().split(/\s+/)[0];
  return el.tagName.toLowerCase();
}
function nearestSection(el: Element): Element | null {
  let node: Element | null = el;
  while (node && node !== node.ownerDocument?.body) { if (classify(node) === "section" && node !== el) return node; node = node.parentElement; }
  return null;
}

export function installOverlay(doc: Document, win: Window, handlers: OverlayHandlers): OverlayController {
  let mode = handlers.mode, active = handlers.active;
  const refMap = new Map<string, HTMLElement>();

  const hoverBox = doc.createElement("div"), selBox = doc.createElement("div");
  const base = "position:absolute;pointer-events:none;z-index:2147483646;box-sizing:border-box;border-radius:2px;transition:all .04s linear;";
  hoverBox.style.cssText = base + "border:2px solid #6366f1;background:rgba(99,102,241,.12);display:none;";
  selBox.style.cssText = base + "border:2px solid #16a34a;background:rgba(22,163,74,.10);display:none;";
  const label = doc.createElement("div");
  label.style.cssText = "position:absolute;top:-18px;left:0;background:#6366f1;color:#fff;font:600 10px/16px system-ui,sans-serif;padding:0 6px;border-radius:3px;white-space:nowrap;";
  hoverBox.appendChild(label);
  if (doc.body) { doc.body.appendChild(hoverBox); doc.body.appendChild(selBox); }
  let selectedEl: HTMLElement | null = null;

  function place(box: HTMLElement, el: Element) {
    const r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = `${r.left + win.scrollX}px`; box.style.top = `${r.top + win.scrollY}px`;
    box.style.width = `${r.width}px`; box.style.height = `${r.height}px`;
  }

  function buildDescriptor(el: Element): ElementDescriptor {
    const type = classify(el), isH = /^h[1-6]$/.test(type);
    const headingText = isH ? textOf(el, 160) : null;
    const section = nearestSection(el);
    const allSections = Array.from(doc.querySelectorAll("section, header, footer, main"));
    const sectionOrder = section ? allSections.indexOf(section) : (type === "section" ? allSections.indexOf(el) : null);
    const clsRaw = (el as HTMLElement).className; const cls = typeof clsRaw === "string" ? clsRaw : "";
    const refText = isH && headingText ? `::${headingText.slice(0, 60)}` : "";
    const element_ref = `${handlers.slug}::${type}::${domIndexPath(el, doc)}${refText}`;
    refMap.set(element_ref, el as HTMLElement);
    const r = el.getBoundingClientRect();
    return {
      element_ref, element_type: type,
      element_label: isH ? (headingText || `${type.toUpperCase()} heading`) : (type === "section" ? sectionLabel(el) : (textOf(el, 48) || type)),
      heading_text: headingText, heading_level: isH ? Number(type[1]) : null, section_order: sectionOrder,
      parent_section_label: section ? sectionLabel(section) : (type === "section" ? sectionLabel(el) : null),
      dom_selector: cssSelector(el, doc), dom_path: domPath(el), css_classes: cls || null,
      component_name: type === "component" ? el.tagName.toLowerCase() : null,
      content_summary: textOf(el, 160) || null,
      bounding_box: { x: Math.round(r.left + win.scrollX), y: Math.round(r.top + win.scrollY), width: Math.round(r.width), height: Math.round(r.height) },
    };
  }

  function candidateFor(target: Element): Element | null {
    let node: Element | null = target;
    while (node && node !== doc.body) { if (matchesMode(node, mode)) return node; node = node.parentElement; }
    return null;
  }
  function overlapCandidates(target: Element): Element[] {
    const out: Element[] = [], seen = new Set<string>(); let node: Element | null = target;
    while (node && node !== doc.body && out.length < 6) {
      if (isMeaningful(node)) { const t = classify(node); if (!seen.has(t)) { seen.add(t); out.push(node); } }
      node = node.parentElement;
    }
    return out;
  }

  let raf = false;
  function onMove(e: MouseEvent) {
    if (!active || raf) return; raf = true;
    win.requestAnimationFrame(() => {
      raf = false;
      const t = e.target as Element | null;
      if (!t || t === hoverBox || t === selBox) { hoverBox.style.display = "none"; return; }
      const c = candidateFor(t);
      if (!c) { hoverBox.style.display = "none"; return; }
      place(hoverBox, c); label.textContent = classify(c).toUpperCase();
    });
  }
  function onClick(e: MouseEvent) {
    if (!active) return;
    const t = e.target as Element | null; if (!t) return;
    e.preventDefault(); e.stopPropagation();
    if (mode === "auto") {
      const cands = overlapCandidates(t); if (!cands.length) return;
      if (cands.length === 1) { const d = buildDescriptor(cands[0]); selectedEl = cands[0] as HTMLElement; place(selBox, cands[0]); handlers.onSelect(d); }
      else handlers.onOverlap(cands.map(buildDescriptor), e.clientX, e.clientY);
      return;
    }
    const c = candidateFor(t); if (!c) return;
    const d = buildDescriptor(c); selectedEl = c as HTMLElement; place(selBox, c); handlers.onSelect(d);
  }
  function reposition() { if (selectedEl && doc.body.contains(selectedEl)) place(selBox, selectedEl); else selBox.style.display = "none"; }

  doc.addEventListener("mousemove", onMove, true);
  doc.addEventListener("click", onClick, true);
  win.addEventListener("scroll", reposition, true);
  win.addEventListener("resize", reposition);

  return {
    setMode(m) { mode = m; hoverBox.style.display = "none"; },
    setActive(a) { active = a; if (!a) hoverBox.style.display = "none"; },
    selectByRef(ref) {
      const el = refMap.get(ref); if (!el || !doc.body.contains(el)) return null;
      const d = buildDescriptor(el); selectedEl = el; place(selBox, el);
      el.scrollIntoView({ behavior: "smooth", block: "center" }); return d;
    },
    clearSelection() { selectedEl = null; selBox.style.display = "none"; },
    scanOutline() {
      const items: OutlineItem[] = [];
      const set = Array.from(doc.querySelectorAll("section, header, main, h1, h2, h3, h4, h5, h6")).slice(0, 60);
      for (const el of set) {
        const d = buildDescriptor(el), t = classify(el);
        items.push({ element_ref: d.element_ref, type: t, label: d.element_label || sectionLabel(el), level: /^h[1-6]$/.test(t) ? Number(t[1]) : null });
      }
      handlers.onOutline(items);
    },
    destroy() {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("click", onClick, true);
      win.removeEventListener("scroll", reposition, true);
      win.removeEventListener("resize", reposition);
      hoverBox.remove(); selBox.remove(); refMap.clear();
    },
  };
}
```

> The production CMI version also adds **"+ insert content" markers between
> top-level sections** (`setInsertMode`) for "add a new section/row/card/component
> here" requests. That's an optional layer on top of the same engine: enumerate
> top-level `<section>`s, drop a positioned button in each gap, and emit a
> synthetic `section_insert` descriptor on click.

---

## 8. Mounting it (framework-agnostic)

```ts
const iframe = document.querySelector<HTMLIFrameElement>("#preview")!;
let controller: OverlayController | null = null;

iframe.addEventListener("load", () => {
  controller?.destroy();
  let doc: Document | null = null;
  try { doc = iframe.contentDocument; } catch { doc = null; } // cross-origin → null
  const win = iframe.contentWindow;
  if (!doc || !win) return; // preview still shows; overlay just won't attach

  controller = installOverlay(doc, win, {
    slug: currentPageSlug,
    mode: currentMode,
    active: true,
    onSelect: (d) => showInspector(d),
    onOverlap: (cands, x, y) => {
      const rect = iframe.getBoundingClientRect();
      showLevelPicker(cands, rect.left + x, rect.top + y); // position picker in parent space
    },
    onOutline: (items) => renderOutline(items),
  });
  controller.scanOutline();
});

// device widths: set iframe width to 100% / 820px / 390px
// refresh: bump a ?_n= nonce on iframe.src and re-run onLoad
```

**React/Next note:** do all of the above in a `useEffect`/`onLoad`, keep the
`controller` in a `ref`, call `controller.setMode(mode)` / `setActive(active)` in
effects on state change, and `controller.destroy()` on unmount and before each
reload.

---

## 9. Host UI checklist

- **Top bar:** page selector, current URL, device toggle (desktop/tablet/mobile),
  selection-mode dropdown, a "Selecting on/off" toggle, refresh.
- **Preview panel:** the iframe, width driven by the device toggle, centered.
- **Inspector panel:** shows the selected descriptor + a note form
  (priority / status / change-type or whatever your workflow needs).
- **Outline strip:** clickable list of detected headings/sections
  (`controller.selectByRef(ref)` scrolls to + selects them).
- **Level picker:** small popover shown on `onOverlap`, positioned at the passed
  coordinates, listing each candidate's `element_type` + `element_label`.

---

## 10. Gotchas / requirements

- **Same-origin is mandatory** for DOM access. See §2 for fallbacks.
- **Framing headers:** iframe pages need `X-Frame-Options: SAMEORIGIN` and
  `CSP: frame-ancestors 'self'`. A global `DENY` breaks it ("refused to connect").
- **Suppress navigation** while selecting (the overlay calls `preventDefault()` /
  `stopPropagation()` on clicks). Provide a "Selecting off" toggle so users can
  scroll/click links normally.
- **Reposition on scroll/resize** — highlight boxes live inside the iframe
  document and are positioned in document space (`rect + scrollX/Y`).
- **Re-inject on every load** — SPA navigations inside the iframe reset the DOM;
  destroy + reinstall on `load`.
- **Tune `classify()`** to the target design system for good row/column/card/
  component detection; headings + sections work out of the box.

---

## 11. Implementation prompt (paste into your coding agent)

```text
Build a "Visual Page Editor" in <APP>. It loads a same-origin frontend page in an
iframe and lets the user click page elements to select them and attach notes.

Requirements:
1. A page/route with: a page selector, the current page URL, a device toggle
   (desktop 100% / tablet 820px / mobile 390px), a selection-mode dropdown
   (Auto Detect, Sections, Containers, Rows, Columns, Cards, Components,
   Headings Only), a "Selecting on/off" toggle, and a Refresh button.
2. An iframe that loads the selected page from the SAME ORIGIN as the editor.
   Ensure those routes send `X-Frame-Options: SAMEORIGIN` and
   `Content-Security-Policy: frame-ancestors 'self'` (not DENY).
3. On iframe load, access iframe.contentDocument (same-origin) and inject a
   review overlay that:
   - highlights the nearest element matching the active selection mode on hover,
   - on click, prevents navigation and builds a stable ElementDescriptor,
   - in Auto Detect, if multiple element levels are under the cursor, emits a
     list of candidates so the UI can show a level picker,
   - reports a page outline of headings + sections.
   Use the provided `installOverlay(doc, win, handlers)` engine (vanilla TS,
   no deps); adapt classify() to <APP>'s CSS/component conventions.
4. A right-side inspector panel that shows the selected element's details and a
   note form (fields: note text, priority, status, change type). Persist notes
   keyed by the descriptor's `element_ref` so they re-attach on the next visit.
5. A bottom outline strip listing detected headings/sections; clicking one calls
   controller.selectByRef(ref) to scroll to and select it.
6. Do NOT mutate the previewed page — this is review-only. Notes/exports are
   stored server-side; any AI-generated changes must be saved as drafts, never
   auto-published.

Element reference format: `<page_slug>::<element_type>::<dom_index_path>[::<heading_text>]`
where dom_index_path is a chain of `tag[childIndex]` from <body>.

Deliver: the overlay engine module, the editor route/page, the inspector + note
form, the outline strip, the level picker, and the framing-header config. Prefer
the safest same-origin approach; if the target site is cross-origin, implement
the overlay as a cooperating script that talks to the parent via postMessage
using the same ElementDescriptor shape.
```

---

## 12. Reference implementation (in this repo)

The full, production version lives in the CMI app:

- Engine: `apps/cmi-next/app/dashboard/site-content/live-editor/overlay.ts`
- Editor UI: `apps/cmi-next/app/dashboard/site-content/live-editor/live-editor-client.tsx`
- Spec: `docs/cms/live_page_editor.md`

Those add project-specific extras (notes DB, exports, Bolt AI hand-off, insert
markers, Super-Admin gating) on top of the portable engine described here.
