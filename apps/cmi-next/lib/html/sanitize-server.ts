// Server-side HTML sanitizer for rich text that is stored and later rendered
// with dangerouslySetInnerHTML or emailed (punch list notes, executive
// summaries). lib/notes/html.ts sanitizeHtml only works in the browser and
// passes HTML through untouched on the server, so anything an API route
// accepts goes through this instead.
//
// Allow-list, same tags as the rich-text editor. Every attribute is dropped
// except a safe href on <a> and src on <img>. Script-like blocks are removed
// with their content; any other unknown tag is unwrapped (its text is kept).

const ALLOWED = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "a", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "img", "div", "span", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
]);
const VOID = new Set(["br", "img", "hr"]);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math|form|textarea|select|button)\b[\s\S]*?<\/\1\s*>/gi;

function safeUrl(value: string, kind: "href" | "src"): string | null {
  const v = value.trim().replace(/[\u0000-\u001f\s]+/g, "");
  if (kind === "href" && /^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(v)) return value.trim();
  if (kind === "src" && (/^https:/i.test(v) || /^data:image\/(png|jpe?g|gif|webp);/i.test(v) || /^\/(?!\/)/.test(v))) return value.trim();
  return null;
}

const attrEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sanitizeHtmlServer(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, ""); // unclosed openers

  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/g, (_m, slash: string, rawTag: string, rest: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED.has(tag)) return "";
    if (slash) return VOID.has(tag) ? "" : `</${tag}>`;
    let attrs = "";
    if (tag === "a" || tag === "img") {
      const want = tag === "a" ? "href" : "src";
      const m = rest.match(new RegExp(`\\b${want}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
      const url = m ? safeUrl(m[2] ?? m[3] ?? m[4] ?? "", want) : null;
      if (url) attrs += ` ${want}="${attrEscape(url)}"`;
      if (tag === "a") attrs += ` target="_blank" rel="noreferrer noopener"`;
      if (tag === "img") {
        const alt = rest.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
        if (alt) attrs += ` alt="${attrEscape(alt[2] ?? alt[3] ?? "")}"`;
      }
    }
    return `<${tag}${attrs}>`;
  });

  // Any "<" left is not one of our rebuilt tags: make it text.
  return html.replace(/<(?!\/?(?:[a-z][a-z0-9]*)(?:\s[^<>]*)?>)/g, "&lt;").trim();
}
