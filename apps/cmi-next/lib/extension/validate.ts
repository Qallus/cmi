// Lightweight, strict payload validation for the extension API routes. The app
// validates manually everywhere (no zod dependency); these helpers keep that
// convention while guaranteeing we never trust extension input. Every helper
// throws ValidationError (HTTP 400) on bad input.
export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function reqStr(v: unknown, field: string, max = 20000): string {
  if (typeof v !== "string" || !v.trim()) throw new ValidationError(`${field} is required.`);
  const s = v.trim();
  if (s.length > max) throw new ValidationError(`${field} exceeds ${max} characters.`);
  return s;
}

export function optStr(v: unknown, max = 20000): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export function optNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function optBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

export function strList(v: unknown, maxItems = 50, maxLen = 500): string[] {
  const arr = Array.isArray(v) ? v : String(v ?? "").split(/\r?\n/);
  return arr
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((x) => (x.length > maxLen ? x.slice(0, maxLen) : x));
}

export function optUuid(v: unknown, field: string): string | null {
  const s = optStr(v);
  if (!s) return null;
  if (!UUID_RE.test(s)) throw new ValidationError(`${field} must be a valid id.`);
  return s;
}

export function reqHttpUrl(v: unknown, field: string): string {
  const s = reqStr(v, field, 4000);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new ValidationError(`${field} must be a valid URL.`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new ValidationError(`${field} must be an http(s) URL.`);
  }
  return u.toString();
}
