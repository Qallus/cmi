// Selection comment threads: pure helpers shared by the API, the views and the
// tests. Rows live in selection_comments (see the 2026-11-12 migration).

export type CommentAuthorKind = "client" | "staff";
export type SelectionComment = {
  id: string;
  selection_id: string;
  job_id: string | null;
  author_kind: CommentAuthorKind;
  author_contact_id: string | null;
  author_staff_id: string | null;
  author_name: string | null;
  action: string;
  body: string | null;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
};

export type CommentSummary = {
  count: number;
  /** Client comments nobody on the team has handled or answered yet. */
  open: number;
  latest: { author_kind: CommentAuthorKind; author_name: string | null; body: string | null; action: string; created_at: string } | null;
};

export const ACTION_LABEL: Record<string, string> = {
  approved: "Approved", rejected: "Not approved", revision_requested: "Asked for a change", comment: "Comment", reply: "Reply", legacy: "Comment",
};

export const isOpen = (c: Pick<SelectionComment, "author_kind" | "handled_at">) => c.author_kind === "client" && !c.handled_at;

export function summarize(comments: SelectionComment[]): CommentSummary {
  if (!comments.length) return { count: 0, open: 0, latest: null };
  const last = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)!;
  return {
    count: comments.length,
    open: comments.filter(isOpen).length,
    latest: { author_kind: last.author_kind, author_name: last.author_name, body: last.body, action: last.action, created_at: last.created_at },
  };
}

export type LegacyEntry = { created_at: string; author_name: string; body: string; stamped: boolean };

const STAMP = /^([A-Z][a-z]{2} \d{1,2}, \d{4}) · ([^:\n]{1,80}): ?(.*)$/;

/**
 * The old project_selections.client_comments text, as thread entries, oldest
 * first. New notes were prepended as "Nov 9, 2026 · Jane Smith: text" (a note
 * can run over several lines); text with no stamp is from before Nov 9, when a
 * note replaced the last one, and gets the selection's decision date.
 */
export function parseLegacyComments(text: string | null | undefined, fallbackAt: string, fallbackName = "Client"): LegacyEntry[] {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: LegacyEntry[] = [];
  let lead: string[] = [];
  let cur: LegacyEntry | null = null;
  for (const line of lines) {
    const m = line.match(STAMP);
    if (m) {
      if (cur) out.push(cur);
      const at = new Date(`${m[1]} 12:00:00 GMT-0700`);
      cur = { created_at: Number.isNaN(at.getTime()) ? fallbackAt : at.toISOString(), author_name: m[2].trim(), body: m[3], stamped: true };
    } else if (cur) {
      cur.body += `\n${line}`;
    } else {
      lead.push(line);
    }
  }
  if (cur) out.push(cur);
  // Unstamped text before any stamp only happens when there are no stamps at all.
  const legacy = lead.join("\n").trim();
  if (legacy) out.push({ created_at: fallbackAt, author_name: fallbackName, body: legacy, stamped: false });
  for (const e of out) e.body = e.body.trim();
  return out.filter((e) => e.body).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function relTime(iso: string, now = Date.now()): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const mins = Math.round((now - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: new Date(iso).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" });
}
