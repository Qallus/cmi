// Reviewing and merging duplicate contacts.
//
// The merge itself is the `merge_contacts` SQL function: 30 columns across 29
// tables reference contacts, so it discovers the references from the FK
// catalogue rather than hand-listing them, and drops rows that would collide
// with a unique constraint the survivor already satisfies.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Contact } from "./types";

export type DuplicateGroupMember = Contact & {
  /** Rough "how much is attached to this record", to help pick the survivor. */
  activity: number;
};

export type DuplicateGroup = {
  key: string;
  /** What they have in common — "same name", "same phone". */
  reason: string;
  members: DuplicateGroupMember[];
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-10);

/**
 * Contacts that look like the same person, grouped.
 *
 * Deliberately conservative, because merging is destructive and can't be
 * undone. Two rules only:
 *   - the same full name, or
 *   - the same phone number AND the same first name.
 *
 * A shared phone number on its own is NOT a duplicate. In this data most
 * shared numbers belong to genuinely different people — spouses, or a company
 * line copied onto several records ("Eric Pach" and "Gabrielle Tanguma" share
 * one). Grouping on phone alone produced 42 groups, nearly all false; adding
 * the first name brings it to 4, all real. The typeahead's fuzzy tier stays
 * out of here entirely.
 */
export async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const contacts = (data ?? []) as Contact[];

  const byName = new Map<string, Contact[]>();
  const byPhoneAndFirst = new Map<string, Contact[]>();

  for (const c of contacts) {
    const first = norm(c.first_name);
    const name = `${first} ${norm(c.last_name)}`.trim();
    if (name.length > 1) byName.set(name, [...(byName.get(name) ?? []), c]);

    const phone = digits(c.phone);
    if (phone.length === 10 && first) {
      const key = `${phone}:${first}`;
      byPhoneAndFirst.set(key, [...(byPhoneAndFirst.get(key) ?? []), c]);
    }
  }

  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  const add = (key: string, reason: string, members: Contact[]) => {
    if (members.length < 2) return;
    // A set of people already grouped by name shouldn't reappear under phone.
    const fingerprint = members.map((m) => m.id).sort().join("|");
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    groups.push({ key, reason, members: members.map(withActivity) });
  };

  for (const [name, members] of byName) add(`name:${name}`, "same name", members);
  for (const [key, members] of byPhoneAndFirst) add(`phone:${key}`, "same phone number and first name", members);

  // Busiest groups first — those are the ones worth untangling.
  return groups.sort((a, b) => b.members.length - a.members.length);
}

/**
 * A cheap proxy for "this is the record people have actually been using".
 * Real reference counts would be 29 queries per contact; last_activity plus
 * how complete the record is gets the survivor right almost every time.
 */
function withActivity(c: Contact): DuplicateGroupMember {
  const filled = [c.phone, c.company, c.address, c.city, c.notes, c.lead_owner].filter(Boolean).length;
  const recency = c.last_activity ? Math.max(0, 30 - Math.floor((Date.now() - new Date(c.last_activity).getTime()) / 86_400_000)) : 0;
  return { ...c, activity: filled * 10 + recency + (c.tags?.length ?? 0) };
}

export type MergeResult = { ok: true; moved: Record<string, number> };

/**
 * Fold `loserIds` into `survivorId`, after applying `patch` to the survivor so
 * the fields a person chose are the ones kept.
 */
export async function mergeContacts(
  survivorId: string,
  loserIds: string[],
  opts: { patch?: Partial<Contact>; actorId?: string | null } = {},
): Promise<MergeResult> {
  const supabase = getSupabaseAdmin();
  const losers = loserIds.filter((id) => id && id !== survivorId);
  if (losers.length === 0) throw new Error("Choose at least one contact to merge in.");

  // Merge first, patch second. Keeping a duplicate's email means claiming an
  // address the duplicate still holds, and the unique index on lower(email)
  // rejects that until its owner is gone.
  const moved: Record<string, number> = {};
  for (const loser of losers) {
    const { data, error } = await supabase.rpc("merge_contacts", {
      p_survivor: survivorId,
      p_loser: loser,
      p_actor: opts.actorId ?? null,
    });
    if (error) throw new Error(error.message);
    for (const [k, v] of Object.entries((data as MergeResult)?.moved ?? {})) {
      moved[k] = (moved[k] ?? 0) + (v as number);
    }
  }

  if (opts.patch && Object.keys(opts.patch).length > 0) {
    const patch = { ...opts.patch };
    if (typeof patch.email === "string") patch.email = patch.email.trim().toLowerCase();
    const { error } = await supabase
      .from("contacts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", survivorId);
    // The records are already merged at this point, so a failed patch is worth
    // reporting but must not read as "the merge failed".
    if (error) throw new Error(`Merged, but couldn't apply the chosen details: ${error.message}`);
  }

  return { ok: true, moved };
}
