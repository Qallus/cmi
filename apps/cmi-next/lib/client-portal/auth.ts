// Client-portal authentication + authorization.
//
// Clients authenticate with Supabase Auth (invite-only) and carry a SEPARATE
// session cookie (`cmi-client-session`) from staff (`cmi-session`). This keeps a
// client token from ever satisfying the /dashboard gate. A client is authorized
// only if their auth email maps to a `contacts` row that has portal access
// (job_contacts.portal_access_enabled) on at least one portal-enabled job.
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const CLIENT_SESSION_COOKIE = "cmi-client-session";

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

async function resolveClient(token: string | null): Promise<{ userId: string; contact: ClientContact }> {
  if (!token) throw new ClientAuthError("Unauthorized — no client session.", 401);
  const sb = getSupabaseAdmin();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user?.email) throw new ClientAuthError("Unauthorized — invalid or expired session.", 401);

  const { data: contact } = await sb
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company")
    .eq("email", user.email)
    .maybeSingle();
  if (!contact) throw new ClientAuthError("No client record found for this account.", 403);
  if (!(await hasAnyPortalAccess(contact.id))) throw new ClientAuthError("Your account has no active project access.", 403);

  return { userId: user.id, contact: contact as ClientContact };
}

// For route handlers.
export async function requireClient(request: Request | NextRequest) {
  const token = parseCookie((request as Request).headers.get("cookie") ?? "", CLIENT_SESSION_COOKIE);
  return resolveClient(token);
}

// For server components.
export async function getClientSession(): Promise<{ userId: string; contact: ClientContact } | null> {
  const token = (await cookies()).get(CLIENT_SESSION_COOKIE)?.value ?? null;
  try {
    return await resolveClient(token);
  } catch {
    return null;
  }
}

// Assert the client may access this specific job (portal enabled on both sides).
export async function assertJobAccess(contactId: string, jobId: string): Promise<void> {
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
export async function verifyClientJob(jobId: string): Promise<ClientContact | null> {
  const session = await getClientSession();
  if (!session) return null;
  try {
    await assertJobAccess(session.contact.id, jobId);
  } catch {
    return null;
  }
  return session.contact;
}

// The client's per-job visibility permissions (job_contacts.permissions jsonb).
export async function getJobPerms(contactId: string, jobId: string): Promise<Record<string, boolean>> {
  const { data } = await getSupabaseAdmin()
    .from("job_contacts")
    .select("permissions")
    .eq("contact_id", contactId)
    .eq("job_id", jobId)
    .maybeSingle();
  return (data?.permissions ?? {}) as Record<string, boolean>;
}
