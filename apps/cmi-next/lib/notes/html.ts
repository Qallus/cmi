// Helpers for note bodies stored as HTML.

// Plain-text extraction for list previews and search. Regex-based so it works
// on the server and client (no DOM needed). Not for rendering — just for text.
export function htmlToText(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// True when the HTML has no meaningful content (empty editor produces <br>, etc).
export function isEmptyHtml(html: string): boolean {
  return htmlToText(html).length === 0 && !/<img\b/i.test(html || "");
}

// Client-only DOM sanitizer: keep a safe tag/attribute whitelist, drop scripts,
// event handlers, and unsafe URL schemes. Runs before save and before render.
const ALLOWED_TAGS = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "A", "UL", "OL", "LI",
  "H1", "H2", "H3", "BLOCKQUOTE", "CODE", "PRE", "IMG", "DIV", "SPAN",
]);
const ALLOWED_ATTR: Record<string, Set<string>> = {
  A: new Set(["href", "target", "rel"]),
  IMG: new Set(["src", "alt"]),
};

export function sanitizeHtml(html: string): string {
  if (typeof document === "undefined") return html; // server: stored value is already sanitized
  const tpl = document.createElement("template");
  tpl.innerHTML = html || "";

  const walk = (node: Element | DocumentFragment) => {
    for (const child of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        // Unwrap unknown elements: keep their text/children, drop the tag.
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      const allowed = ALLOWED_ATTR[child.tagName] ?? new Set<string>();
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (!allowed.has(name)) { child.removeAttribute(attr.name); continue; }
        if ((name === "href" || name === "src") && /^\s*(javascript|data(?!:image\/)):/i.test(attr.value)) {
          child.removeAttribute(attr.name);
        }
      }
      if (child.tagName === "A") {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noreferrer noopener");
      }
      walk(child);
    }
  };
  walk(tpl.content);
  return (tpl.innerHTML || "").trim();
}
