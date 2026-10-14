// Who's who at CMI, for Bolt.
//
// Two sources, merged per person: the staff account (staff_users: name, title,
// email, phone, dashboard role) and, when they have one, the public website
// profile (team_members: bio, specialties, hours, LinkedIn, profile page).
// Staff without a public page (Fernando, Jeremy) still appear, from their
// account. Names match forgivingly: "Joe" finds Joseph, "Yovanna" finds Yovana.
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SITE = "https://www.constructedmatter.com";

/** Company-wide numbers, for "what's the office number" and the like. */
export const COMPANY_LINES = {
  hq: "(480) 628-4458",
  twilio: "(480) 906-4400",
  note: "HQ is the main office line. The Twilio line is CMI's business number for texts and calls made from the dashboard.",
};

/** The company's two owners. */
const OWNERS: Record<string, string> = {
  "brandon@constructedmatter.com": "Owner and co-founder",
  "joe@constructedmatter.com": "Owner and co-founder",
};

/** Common short names, so "Joe" or "Ben" finds the full name. */
const NICKNAMES: Record<string, string[]> = {
  joseph: ["joe", "joey", "jb"],
  benjamin: ["ben"],
  jeremy: ["jer"],
  fernando: ["nando", "fern"],
  brandon: ["bf"],
};

export type TeamPerson = {
  name: string;
  job_title: string | null;
  owner: string | null;
  email: string | null;
  /** Direct line for the dashboard and Bolt; not shown on the public website. */
  phone: string | null;
  dashboard_role: string | null;
  account_status: string | null;
  bio: string | null;
  headline: string | null;
  specialties: string[];
  hours: string | null;
  linkedin: string | null;
  profile_page: string | null;
  profile_note: string | null;
  photo: string | null;
};

function formatPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return (raw ?? "").trim() || null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/** Edit distance, for catching misspellings like "Ferenando". */
function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function wordMatches(query: string, word: string): boolean {
  if (!query || !word) return false;
  if (word.startsWith(query) || query.startsWith(word)) return query.length >= 2;
  const allowed = word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0;
  return distance(query, word) <= allowed;
}

export async function loadTeamDirectory(): Promise<TeamPerson[]> {
  const sb = getSupabaseAdmin();
  const [staffRes, teamRes] = await Promise.all([
    sb.from("staff_users").select("display_name, first_name, last_name, email, phone, title, job_title, role_slug, status, metadata")
      .in("status", ["active", "invited", "pending"]).neq("role_slug", "client"),
    sb.from("team_members").select("name, slug, role, bio, tagline, email, phone, profile_photo, attributes, availability, status"),
  ]);

  type Staff = { display_name: string | null; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; title: string | null; job_title: string | null; role_slug: string | null; status: string | null; metadata: Record<string, unknown> | null };
  type Team = { name: string; slug: string | null; role: string | null; bio: string | null; tagline: string | null; email: string | null; phone: string | null; profile_photo: string | null; attributes: string[] | null; availability: string | null; status: string | null };

  // One entry per person: duplicate accounts (a personal email beside the
  // company one) collapse onto the constructedmatter.com account.
  const staffByName = new Map<string, Staff>();
  for (const s of (staffRes.data ?? []) as Staff[]) {
    const key = norm(s.display_name || `${s.first_name ?? ""} ${s.last_name ?? ""}`);
    if (!key) continue;
    const prev = staffByName.get(key);
    const isCompany = (s.email ?? "").toLowerCase().endsWith("@constructedmatter.com");
    if (!prev || (isCompany && !(prev.email ?? "").toLowerCase().endsWith("@constructedmatter.com"))) staffByName.set(key, s);
  }
  const teamByName = new Map<string, Team>();
  for (const t of (teamRes.data ?? []) as Team[]) if (t.status !== "archived") teamByName.set(norm(t.name), t);

  const names = new Set([...staffByName.keys(), ...teamByName.keys()]);
  const people: TeamPerson[] = [];
  for (const key of names) {
    const s = staffByName.get(key);
    const t = teamByName.get(key);
    let details: { linkedin_url?: string } = {};
    try { details = t?.tagline?.startsWith("{") ? JSON.parse(t.tagline) : {}; } catch { /* plain tagline */ }
    const email = (s?.email || t?.email || "").trim() || null;
    // Staff accounts hold each person's direct number; the website profile
    // phone is only a fallback for someone without an account.
    const phone = formatPhone(s?.phone) ?? formatPhone(t?.phone);
    const meta = s?.metadata ?? {};
    people.push({
      name: s?.display_name || t?.name || key,
      job_title: s?.job_title || s?.title || t?.role || null,
      owner: email ? OWNERS[email.toLowerCase()] ?? null : null,
      email,
      phone,
      dashboard_role: s?.role_slug ? s.role_slug.replace(/_/g, " ") : null,
      account_status: s?.status ?? null,
      bio: t?.bio || (typeof meta.bio === "string" ? meta.bio : null),
      headline: typeof meta.headline === "string" ? meta.headline : null,
      specialties: t?.attributes ?? [],
      hours: t?.availability?.replace(/\s+/g, " ").trim() || null,
      linkedin: details.linkedin_url ?? null,
      profile_page: t?.slug ? `${SITE}/team/${t.slug}` : null,
      profile_note: typeof meta.profile_note === "string" ? meta.profile_note : t ? null : "No public profile page yet.",
      photo: t?.profile_photo ?? null,
    });
  }
  // Owners first, then alphabetical.
  return people.sort((a, b) => Number(!!b.owner) - Number(!!a.owner) || a.name.localeCompare(b.name));
}

/** People whose name, nickname, title or email matches the query. Empty query → everyone. */
export function findPeople(people: TeamPerson[], query: string): TeamPerson[] {
  const words = norm(query).split(" ").filter((w) => w.length >= 2 && !["the", "who", "is", "our", "and", "of"].includes(w));
  if (!words.length) return people;
  const scored = people.map((p) => {
    const nameWords = norm(p.name).split(" ");
    const aliases = nameWords.flatMap((w) => NICKNAMES[w] ?? []);
    const other = norm(`${p.job_title ?? ""} ${p.owner ?? ""} ${p.email ?? ""}`).split(" ");
    let score = 0;
    for (const q of words) {
      if (nameWords.some((w) => wordMatches(q, w)) || aliases.includes(q)) score += 3;
      else if (other.some((w) => w && wordMatches(q, w))) score += 1;
    }
    return { p, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const best = scored[0].score;
  return scored.filter((x) => x.score >= Math.max(1, best - 1)).map((x) => x.p);
}
