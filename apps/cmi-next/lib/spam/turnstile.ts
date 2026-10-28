// Spam protection for public forms: Cloudflare Turnstile (when configured),
// a honeypot field and a minimum time-to-submit. Server-side verification only.
//
// Env (both runtime-only in Coolify): TURNSTILE_SITE_KEY (public; pages pass it
// to the widget) and TURNSTILE_SECRET_KEY (secret). With neither set, only the
// honeypot and timing checks run.

export const HONEYPOT_FIELD = "company_website";
const MIN_FILL_MS = 3_000;

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SECRET_KEY ? (process.env.TURNSTILE_SITE_KEY ?? null) : null;
}

/** Verify a Turnstile token with Cloudflare. True when Turnstile isn't configured. */
export async function verifyTurnstile(token: unknown, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8_000) });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean };
    return json.success === true;
  } catch {
    // Cloudflare unreachable: don't block real people over it.
    return true;
  }
}

/**
 * Bot tells that don't need a third party: the hidden honeypot was filled, or
 * the form was submitted faster than a person could. Returns the reason, or null.
 */
export function botReason(body: Record<string, unknown>): string | null {
  const trap = body[HONEYPOT_FIELD];
  if (typeof trap === "string" && trap.trim()) return "honeypot";
  const started = Number(body.startedAt);
  if (Number.isFinite(started) && started > 0 && Date.now() - started < MIN_FILL_MS) return "too_fast";
  return null;
}

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : headers.get("x-real-ip");
}
