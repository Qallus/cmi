import { API_BASE } from "./config";
import { getToken } from "./auth";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (json.error as string) ?? `Request failed (${res.status})`,
      res.status,
      json.code as string | undefined,
    );
  }
  return json as T;
}

export const api = {
  session: () => req("/api/extension/session"),
  jobs: (q: string) => req<{ jobs: unknown[] }>(`/api/extension/jobs?q=${encodeURIComponent(q)}`),
  groups: (jobId?: string) =>
    req<{ groups: unknown[] }>(`/api/extension/selections${jobId ? `?job_id=${encodeURIComponent(jobId)}` : ""}`),
  createGroup: (body: unknown) =>
    req<{ group: unknown }>("/api/extension/selections", { method: "POST", body: JSON.stringify(body) }),
  createCard: (body: unknown) =>
    req<{ card: { id: string }; dashboard_url: string }>("/api/extension/cards", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  ingestImage: (url: string) =>
    req<{ url: string; path: string }>("/api/extension/images", { method: "POST", body: JSON.stringify({ url }) }),
};
