// Pure helpers for the Google Workspace client. No I/O and no path aliases, so
// lib/google/parse.test.mjs can run them directly.
import { createSign } from "node:crypto";

export type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

export const GOOGLE_SCOPES = {
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  drive: "https://www.googleapis.com/auth/drive.readonly",
  sheets: "https://www.googleapis.com/auth/spreadsheets.readonly",
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
} as const;

/** Accepts the key file's JSON as pasted, or base64 of it. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw?.trim()) return null;
  const text = raw.trim().startsWith("{") ? raw.trim() : Buffer.from(raw.trim(), "base64").toString("utf8");
  try {
    const sa = JSON.parse(text) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) return null;
    return { ...sa, private_key: sa.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

/** Signed JWT for the domain-wide-delegation token exchange, acting as `subject`. */
export function buildAssertion(sa: ServiceAccount, subject: string, scope: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: sa.client_email, sub: subject, scope,
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: nowSec, exp: nowSec + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  return `${unsigned}.${signature}`;
}

/** "2026-10-20", "3d", "24h" or an ISO time → Date (default: `fallbackDays` ago). */
export function parseSince(since: unknown, fallbackDays = 7, now = Date.now()): Date {
  if (typeof since === "string" && since.trim()) {
    const s = since.trim();
    const rel = s.match(/^(\d+)\s*([dh])$/i);
    if (rel) return new Date(now - Number(rel[1]) * (rel[2].toLowerCase() === "d" ? 86_400_000 : 3_600_000));
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(now - fallbackDays * 86_400_000);
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };

/** Best plain-text body of a Gmail message payload (text/plain, else stripped HTML). */
export function extractGmailText(payload: GmailPart | undefined): string {
  if (!payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (p: GmailPart) => {
    if (p.body?.data) {
      if (p.mimeType === "text/plain") plain.push(decodeBase64Url(p.body.data));
      else if (p.mimeType === "text/html") html.push(decodeBase64Url(p.body.data));
    }
    p.parts?.forEach(walk);
  };
  walk(payload);
  if (plain.length) return plain.join("\n").trim();
  return htmlToText(html.join("\n"));
}

/** Drop quoted reply history ("On … wrote:" and ">" lines) to keep threads short. */
export function stripQuoted(text: string): string {
  const cut = text.search(/\n(On .{5,200}wrote:|-{2,}\s*Original Message\s*-{2,}|From: .+\nSent: )/i);
  const body = cut > 0 ? text.slice(0, cut) : text;
  return body.split("\n").filter((l) => !l.startsWith(">")).join("\n").trim();
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n…(truncated)` : text;
}
