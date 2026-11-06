// "Preview as client" (client portal Phase 1): staff open the real portal for
// one job, seeing exactly what one of its client contacts would see. The token
// is signed on the server, lasts 30 minutes, covers one job and one contact,
// and is read-only: every client API refuses changes while it's in use.
// No client account, invite or email is involved. Server only.
import { createHmac, timingSafeEqual } from "node:crypto";

export const PREVIEW_COOKIE = "cmi-client-preview";
export const PREVIEW_MAX_AGE = 30 * 60;

export type ClientPreview = { jobId: string; contactId: string; staffId: string; exp: number };

function secret(): string {
  const s = process.env.CLIENT_PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Preview can't be signed on this server.");
  return s;
}
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(`client-preview.${body}`).digest("base64url");

export function signPreview(p: Omit<ClientPreview, "exp">, now = Date.now()): string {
  const body = b64(JSON.stringify({ ...p, exp: Math.floor(now / 1000) + PREVIEW_MAX_AGE }));
  return `${body}.${sign(body)}`;
}

/** The preview this token grants, or null if it's missing, tampered with or expired. */
export function readPreview(token: string | null | undefined, now = Date.now()): ClientPreview | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  let good: Buffer, got: Buffer;
  try { good = Buffer.from(sign(body)); got = Buffer.from(mac); } catch { return null; }
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as ClientPreview;
    if (!p.jobId || !p.contactId || !p.staffId || !p.exp || p.exp * 1000 < now) return null;
    return p;
  } catch { return null; }
}
