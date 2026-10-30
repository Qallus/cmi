// Landing pages built from the CMS template (site_pages), Super Admin only.
// Read-only here: they're created and changed through Claude (CMI connector),
// which previews and confirms every publish.
import { ExternalLink, Eye, FileText } from "lucide-react";
import type { SitePage } from "@/lib/site-pages/data";

const TONE: Record<SitePage["status"], string> = {
  published: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  draft: "bg-muted text-muted-foreground",
  unpublished: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export function SitePagesPanel({ pages }: { pages: SitePage[] }) {
  return (
    <section className="mx-4 mt-4 rounded-lg border border-border bg-card p-4 md:mx-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-accent" /> Landing pages</h2>
        <p className="text-xs text-muted-foreground">Ask Claude to create or edit one (e.g. “draft a landing page for kitchen remodels”). Publishing always shows you a preview first.</p>
      </div>
      {pages.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-border py-5 text-center text-sm text-muted-foreground">No landing pages yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {pages.map((p) => {
            const changed = JSON.stringify(p.draft) !== JSON.stringify(p.published);
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.draft.title || p.slug}</p>
                  <p className="text-xs text-muted-foreground">/lp/{p.slug} · published {when(p.published_at)}{changed && p.status === "published" ? " · draft has unpublished changes" : ""}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${TONE[p.status]}`}>{p.status}</span>
                  <a href={`/lp/${p.slug}?preview=${p.preview_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Eye className="h-3.5 w-3.5" /> Preview</a>
                  {p.status === "published" && <a href={`/lp/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Live</a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
