// Client-portal authentication + authorization.
//
// Clients authenticate with Supabase Auth (invite-only) and carry a SEPARATE
// session cookie (`cmi-client-session`) from staff (`cmi-session`). This keeps a
// client token from ever satisfying the /dashboard gate. A client is authorized
// only if their auth email maps to a `contacts` row that has portal access
// (job_contacts.portal_access_enabled) on at least one portal-enabled job.
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CLIENT_SESSION_COOKIE, CLIENT_REFRESH_COOKIE } from "@/lib/auth/tokens";
import { PREVIEW_COOKIE, readPreview, type ClientPreview } from "./preview";

export { CLIENT_SESSION_COOKIE, CLIENT_REFRESH_COOKIE };

export type ClientContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
};

export class ClientAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function parseCookie(header: string, name: string): string | null {
  const match = header.split(";").find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.trim().slice(name.length + 1)) || null;
}

// Does this contact have portal access to at least one portal-enabled job?
async function hasAnyPortalAccess(contactId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("job_contacts")
    .select("job_id, portal_access_enabled, jobs!inner(client_portal_enabled)")
    .eq("contact_id", contactId)
    .eq("portal_access_enabled", true)
    .eq("jobs.client_portal_enabled", true)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// Case-insensitive contact lookup for a portal login. Emails are stored with
// mixed case and occasionally duplicated, so prefer the match that actually
// has portal access. `contact` is set whenever any row matches, `hasAccess`
// says whether that row may enter the portal.
export async function findPortalContactByEmail(
  email: string,
): Promise<{ contact: ClientContact | null; hasAccess: boolean }> {
  const addr = email.trim();
  if (!addr) return { contact: null, hasAccess: false };
  const pattern = addr.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await getSupabaseAdmin()
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company")
    .ilike("email", pattern)
    .limit(5);
  const rows = (data ?? []) as ClientContact[];
  for (const row of rows) {
    if (await hasAnyPortalAccess(row.id)) return { contact: row, hasAccess: true };
  }
  return { contact: rows[0] ?? null, hasAccess: false };
}

export type ClientSession = { userId: string; contact: ClientContact; preview?: ClientPreview };

/** Staff "Preview as client": the contact the preview is for (any client contact on that job). */
async function resolvePreview(p: ClientPreview): Promise<ClientSession> {
  const { data } = await getSupabaseAdmin().from("job_contacts")
    .select("contact:contacts(id, first_name, last_name, email, phone, company)")
    .eq("job_id", p.jobId).eq("contact_id", p.contactId).maybeSingle();
  const contact = (data as { contact: ClientContact | null } | null)?.contact;
  if (!contact) throw new ClientAuthError("This preview is no longer valid.", 403);
  return { userId: `preview:${p.staffId}`, contact: { ...contact, email: contact.email ?? "" }, preview: p };
}

/** The preview in this request's cookies (server components and route handlers). */
export const getPreview = cache(async (): Promise<ClientPreview | null> => {
  try { return readPreview((await cookies()).get(PREVIEW_COOKIE)?.value); } catch { return null; }
});

async function resolveClient(token: string | null, previewToken?: string | null): Promise<ClientSession> {
  const preview = readPreview(previewToken);
  if (preview) return resolvePreview(preview);
  if (!token) throw new ClientAuthError("Unauthorized — no client session.", 401);
  const sb = getSupabaseAdmin();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user?.email) throw new ClientAuthError("Unauthorized — invalid or expired session.", 401);

  const { contact, hasAccess } = await findPortalContactByEmail(user.email);
  if (!contact) throw new ClientAuthError("No client record found for this account.", 403);
  if (!hasAccess) throw new ClientAuthError("Your account has no active project access.", 403);

  return { userId: user.id, contact };
}

// For route handlers. A staff preview can read but never change anything.
export async function requireClient(request: Request | NextRequest) {
  const header = (request as Request).headers.get("cookie") ?? "";
  const session = await resolveClient(parseCookie(header, CLIENT_SESSION_COOKIE), parseCookie(header, PREVIEW_COOKIE));
  const method = ((request as Request).method ?? "GET").toUpperCase();
  if (session.preview && method !== "GET" && method !== "HEAD") throw new ClientAuthError("This is a preview: nothing can be changed or sent.", 403);
  return session;
}

// For server components. Cached per request so a layout and its page share one
// auth round-trip.
export const getClientSession = cache(async (): Promise<ClientSession | null> => {
  const jar = await cookies();
  try {
    return await resolveClient(jar.get(CLIENT_SESSION_COOKIE)?.value ?? null, jar.get(PREVIEW_COOKIE)?.value ?? null);
  } catch {
    return null;
  }
});

// Assert the client may access this specific job (portal enabled on both sides).
export async function assertJobAccess(contactId: string, jobId: string): Promise<void> {
  // A preview covers exactly one job and contact, whether or not the portal is on yet.
  const preview = await getPreview();
  if (preview) {
    if (preview.jobId === jobId && preview.contactId === contactId) return;
    throw new ClientAuthError("This preview is for another project.", 403);
  }
  const { data } = await getSupabaseAdmin()
    .from("job_contacts")
    .select("id, portal_access_enabled, jobs!inner(client_portal_enabled)")
    .eq("contact_id", contactId)
    .eq("job_id", jobId)
    .eq("portal_access_enabled", true)
    .eq("jobs.client_portal_enabled", true)
    .maybeSingle();
  if (!data) throw new ClientAuthError("You don't have access to this project.", 403);
}

// Server-component helper: resolve the session AND verify this job is accessible.
// Returns the client contact, or null (caller should redirect). Every client job
// page calls this — pages render independently of the layout, so access is
// re-checked here rather than trusting the layout.
export const verifyClientJob = cache(async (jobId: string): Promise<ClientContact | null> => {
  const session = await getClientSession();
  if (!session) return null;
  try {
    await assertJobAccess(session.contact.id, jobId);
  } catch {
    return null;
  }
  return session.contact;
});

// The client's per-job visibility permissions (job_contacts.permissions jsonb).
export const getJobPerms = cache(async (contactId: string, jobId: string): Promise<Record<string, boolean>> => {
  const { data } = await getSupabaseAdmin()
    .from("job_contacts")
    .select("permissions")
    .eq("contact_id", contactId)
    .eq("job_id", jobId)
    .maybeSingle();
  return (data?.permissions ?? {}) as Record<string, boolean>;
});
