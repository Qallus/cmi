// Server-side checks against ai_access_grants. Service role — server code only.
//
// Resolution for one person + capability:
//   1. a live row with enabled=false  → off (explicit override)
//   2. a live row with enabled=true   → on
//   3. no live row                    → the default (staff: by role; contacts: defaultForContacts)
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AI_CAPABILITIES, getCapability, isDefaultFor, type AiCapabilityKey } from "./capabilities";

export type AiSubject =
  | { type: "staff"; staffUserId: string; role: string | null | undefined }
  | { type: "contact"; contactId: string };

/** Every capability this person effectively has. */
export async function loadAiCapabilities(subject: AiSubject): Promise<Set<AiCapabilityKey>> {
  const column = subject.type === "staff" ? "staff_user_id" : "contact_id";
  const id = subject.type === "staff" ? subject.staffUserId : subject.contactId;

  const { data } = await getSupabaseAdmin()
    .from("ai_access_grants")
    .select("capability, enabled")
    .eq(column, id)
    .is("revoked_at", null);
  const explicit = new Map((data ?? []).map((r) => [r.capability as string, r.enabled as boolean]));

  const out = new Set<AiCapabilityKey>();
  for (const cap of AI_CAPABILITIES) {
    if (!(cap.appliesTo as readonly string[]).includes(subject.type)) continue;
    const set = explicit.get(cap.key);
    const on = set ?? isDefaultFor(cap, subject.type === "staff" ? { type: "staff", role: subject.role } : { type: "contact" });
    if (on) out.add(cap.key);
  }
  return out;
}

export async function hasAiCapability(subject: AiSubject, capability: AiCapabilityKey): Promise<boolean> {
  if (!getCapability(capability)) return false;
  return (await loadAiCapabilities(subject)).has(capability);
}
