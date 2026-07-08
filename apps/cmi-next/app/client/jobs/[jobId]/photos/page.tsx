import { redirect } from "next/navigation";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { loadClientFiles } from "@/lib/client-portal/data";

export const dynamic = "force-dynamic";

export default async function ClientPhotosPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const { photos } = await loadClientFiles(jobId);

  if (photos.length === 0) return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No photos have been shared yet.</div>;

  // Group by folder ("album").
  const albums = new Map<string, typeof photos>();
  for (const p of photos) { const k = p.folder ?? "Photos"; albums.set(k, [...(albums.get(k) ?? []), p]); }

  return (
    <div className="space-y-8">
      {[...albums.entries()].map(([album, items]) => (
        <div key={album}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">{album}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((p) => (
              <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg bg-muted">
                <img src={p.file_url} alt={p.name} className="aspect-square w-full object-cover transition group-hover:opacity-90" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
