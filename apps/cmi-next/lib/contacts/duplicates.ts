// Finding probable duplicate contacts.
//
// `contacts.email` is unique, so the same email can't be saved twice. The
// duplicates that actually pile up are one person with two addresses — a work
// and a personal one — which only a name or phone match catches. The ranking
// itself lives in the `find_duplicate_contacts` SQL function so the lookup and
// the save-time guard can't disagree.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type DuplicateMatch = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  type: string | null;
  created_at: string;
  score: number;
  reason: string;
};

/**
 * How sure we are, and therefore how loudly to say it:
 *  - "certain"  the email is already taken; saving would fail anyway
 *  - "likely"   same phone, or same name at the same company
 *  - "possible" same or similar name — a hint only, never a blocker
 */
export type Confidence = "certain" | "likely" | "possible";

export function confidenceOf(score: number): Confidence {
  if (score >= 100) return "certain";
  if (score >= 75) return "likely";
  return "possible";
}

export type DuplicateLookup = {
  first?: string | null;
  last?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  /** When editing, the contact being edited is not its own duplicate. */
  excludeId?: string | null;
  limit?: number;
};

/** Ranked possible duplicates, strongest first. Empty when nothing looks close. */
export async function findDuplicateContacts(input: DuplicateLookup): Promise<DuplicateMatch[]> {
  const name = `${input.first ?? ""}${input.last ?? ""}`.trim();
  const digits = (input.phone ?? "").replace(/\D/g, "");
  const email = (input.email ?? "").trim();

  // Too little to go on — don't make the server guess from one letter.
  if (name.length < 2 && digits.length < 10 && !email.includes("@")) return [];

  const { data, error } = await getSupabaseAdmin().rpc("find_duplicate_contacts", {
    p_first: input.first ?? null,
    p_last: input.last ?? null,
    p_email: email || null,
    p_phone: input.phone ?? null,
    p_company: input.company ?? null,
    p_exclude: input.excludeId ?? null,
    p_limit: input.limit ?? 5,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as DuplicateMatch[];
}

export function fullName(m: Pick<DuplicateMatch, "first_name" | "last_name">): string {
  return `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Unnamed contact";
}

/**
 * The save-time guard. Returns the blocking match when one exists, so the API
 * can answer with "that email already belongs to X" instead of letting a raw
 * unique-violation reach the screen.
 *
 * Only "certain" matches block on their own; a "likely" match blocks until the
 * caller confirms, because two real people do sometimes share a phone.
 */
export async function blockingDuplicate(
  input: DuplicateLookup,
  opts: { confirmed?: boolean } = {},
): Promise<DuplicateMatch | null> {
  const matches = await findDuplicateContacts({ ...input, limit: 3 });
  const certain = matches.find((m) => confidenceOf(m.score) === "certain");
  if (certain) return certain;
  if (opts.confirmed) return null;
  return matches.find((m) => confidenceOf(m.score) === "likely") ?? null;
}
