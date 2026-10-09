// Server-side client for the Paperclip control plane.
//
// The whole module is built around one rule from the integration plan: the CMI
// app must stay fully usable when Paperclip is down. So nothing here throws.
// Every call returns a PaperclipResult, and a failure is a value the UI
// renders, not an exception that takes a page with it.
//
// Credentials never leave the server — callers reach this through
// /api/paperclip/*, never from the browser.
import type {
  PaperclipAgent, PaperclipApproval, PaperclipDashboard, PaperclipIssue,
  PaperclipResult, PaperclipUnavailable,
} from "./types";

const TIMEOUT_MS = 8_000;

type Config = { baseUrl: string; apiKey: string; companyId: string };

/** Missing env is a configuration state, not an error. */
function readConfig(): Config | PaperclipUnavailable {
  const baseUrl = process.env.PAPERCLIP_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.PAPERCLIP_API_KEY?.trim();
  const companyId = process.env.PAPERCLIP_COMPANY_ID?.trim();

  const missing: string[] = [];
  if (!baseUrl) missing.push("PAPERCLIP_BASE_URL");
  if (!apiKey) missing.push("PAPERCLIP_API_KEY");
  if (!companyId) missing.push("PAPERCLIP_COMPANY_ID");
  if (missing.length > 0) return { reason: "unconfigured", missing };

  return { baseUrl: baseUrl!, apiKey: apiKey!, companyId: companyId! };
}

export function paperclipConfigured(): boolean {
  return !("reason" in readConfig());
}

/** Where people open Paperclip. Falls back to CMI's own instance, so the link works before the API is wired up. */
export const PAPERCLIP_APP_URL = "https://paperclip.constructedmatter.com";

export function paperclipBaseUrl(): string {
  const url = process.env.PAPERCLIP_BASE_URL?.trim().replace(/\/+$/, "");
  return url || PAPERCLIP_APP_URL;
}

async function get<T>(path: string): Promise<PaperclipResult<T>> {
  const config = readConfig();
  if ("reason" in config) return { ok: false, unavailable: config };

  // An unreachable Paperclip must not hold a dashboard request open.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${config.baseUrl}/api${path}`, {
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      // Worth distinguishing: an agent key cannot reach board-scoped
      // endpoints, and that reads as a permissions problem rather than a
      // broken deployment.
      return {
        ok: false,
        unavailable: {
          reason: "unauthorized",
          detail: res.status === 401
            ? "Paperclip rejected the API key."
            : "The API key is valid but not permitted for this endpoint.",
        },
      };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const message = body.slice(0, 200) || `HTTP ${res.status}`;
      return { ok: false, unavailable: { reason: "error", detail: message } };
    }

    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const detail = (err as Error)?.name === "AbortError"
      ? `Paperclip did not respond within ${TIMEOUT_MS / 1000}s.`
      : (err as Error)?.message ?? "Could not reach Paperclip.";
    return { ok: false, unavailable: { reason: "unreachable", detail } };
  } finally {
    clearTimeout(timer);
  }
}

function companyPath(suffix: string): string | null {
  const config = readConfig();
  if ("reason" in config) return null;
  return `/companies/${encodeURIComponent(config.companyId)}${suffix}`;
}

async function getCompanyScoped<T>(suffix: string): Promise<PaperclipResult<T>> {
  const path = companyPath(suffix);
  if (!path) return { ok: false, unavailable: readConfig() as PaperclipUnavailable };
  return get<T>(path);
}

/**
 * Paperclip returns either a bare array or an envelope depending on the
 * endpoint. Normalise so callers never have to care.
 */
function asArray<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const inner = (value as Record<string, unknown>)[key];
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

export async function listAgents(): Promise<PaperclipResult<PaperclipAgent[]>> {
  const res = await getCompanyScoped<unknown>("/agents");
  return res.ok ? { ok: true, data: asArray<PaperclipAgent>(res.data, "agents") } : res;
}

export async function listIssues(): Promise<PaperclipResult<PaperclipIssue[]>> {
  const res = await getCompanyScoped<unknown>("/issues");
  return res.ok ? { ok: true, data: asArray<PaperclipIssue>(res.data, "issues") } : res;
}

export async function listApprovals(): Promise<PaperclipResult<PaperclipApproval[]>> {
  const res = await getCompanyScoped<unknown>("/approvals");
  return res.ok ? { ok: true, data: asArray<PaperclipApproval>(res.data, "approvals") } : res;
}

export async function getDashboard(): Promise<PaperclipResult<PaperclipDashboard>> {
  return getCompanyScoped<PaperclipDashboard>("/dashboard");
}

/** Confirms the key works and says which identity it resolves to. */
export async function whoAmI(): Promise<PaperclipResult<{ id?: string; name?: string | null }>> {
  return get<{ id?: string; name?: string | null }>("/agents/me");
}
