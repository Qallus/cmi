"use client";

// Photos & videos on a Pre-Con opportunity: site visits, existing conditions.
// Added from the mobile Camera button or here; files go to the cmi-media bucket.
import * as React from "react";
import { Camera, ImagePlus, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type Media = { id: string; url: string; media_type: "image" | "video"; name: string | null; note: string | null; created_by: string | null; created_at: string };

export function OpportunityMedia({ opportunityId, canWrite }: { opportunityId: string; canWrite: boolean }) {
  const [media, setMedia] = React.useState<Media[] | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/pipeline/${opportunityId}/media`);
    setMedia(res.ok ? await res.json() : []);
  }, [opportunityId]);
  React.useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function upload(files: File[]) {
    if (!files.length) return;
    setUploading(true); setError(null);
    try {
      const saved: { url: string; type: string; name: string }[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file, file.name);
        fd.append("folder", `pre-con/${opportunityId}`);
        const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { message?: string }).message ?? "Upload failed.");
        saved.push({ url: (json as { url: string }).url, type: file.type.startsWith("video/") ? "video" : "image", name: file.name });
      }
      const res = await fetch(`/api/pipeline/${opportunityId}/media`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media: saved }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Camera className="h-4 w-4 text-accent" /> Photos</h2>
        {canWrite && (
          <>
            <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden
              onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void upload(f); }} />
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Add photos
            </Button>
          </>
        )}
      </div>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      {media === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : media.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet. Add them here, or use the Camera button on a phone.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => (
            <li key={m.id}>
              <a href={m.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-md border border-border bg-muted">
                {m.media_type === "video" ? (
                  <span className="flex aspect-[4/3] items-center justify-center text-muted-foreground"><Play className="h-8 w-8" /></span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- user uploads from the public media bucket
                  <img src={m.url} alt={m.note || m.name || "Pre-Con photo"} className="aspect-[4/3] w-full object-cover transition group-hover:opacity-90" />
                )}
              </a>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {m.note || new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
