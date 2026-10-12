"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Camera, CheckCircle2, ChevronUp, Eye, HardHat, Home, IdCard, Image as ImageIcon, Images, LayoutDashboard, Loader2, Mail, Mic, NotebookPen, Package, Phone, Sparkles, Users, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobVoiceRecorder } from "./job-voice-recorder";
import {
  MediaDestinationPicker, useMediaTargets, EMPTY_DEST, destPhrase,
  destReady as isDestReady, canShareWithClient as canShare, type MediaDestState,
} from "./media-destination";

// Fixed, horizontally-scrollable quick-nav for mobile/tablet. Dismissable, with
// the closed state remembered. Hidden on desktop (the sidebar covers that).
type NavItem = { label: string; icon: typeof Home; href?: string; action?: "camera" | "record" };
const ITEMS: NavItem[] = [
  { href: "/dashboard/overview", label: "Dashboard", icon: Home },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/selections", label: "Selections", icon: Package },
  { href: "/dashboard/jobs", label: "Jobs", icon: HardHat },
  { href: "/dashboard/daily-logs?new=1", label: "Daily Log", icon: NotebookPen },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/dashboard/documents", label: "Workspace", icon: LayoutDashboard },
  { href: "/dashboard/communications?panel=dialer", label: "Call", icon: Phone },
  { href: "/dashboard/communications?panel=email", label: "Email", icon: Mail },
  { action: "record", label: "Record", icon: Mic },
  { action: "camera", label: "Camera", icon: Camera },
  { href: "/dashboard/business-cards", label: "Cards", icon: IdCard },
  { href: "/dashboard/agent", label: "Bolt", icon: Sparkles },
];

const STORAGE_KEY = "cmi_mobilenav_closed";

type MediaKind = "image" | "video";
type Picked = { file: File; url: string; kind: MediaKind };

export function MobileBottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);

  const photoRef = React.useRef<HTMLInputElement>(null);
  const galleryCaptureRef = React.useRef<HTMLInputElement>(null);
  const galleryLibraryRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLInputElement>(null);

  const [recorderOpen, setRecorderOpen] = React.useState(false);

  // Media capture state
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"photo" | "gallery" | "video" | null>(null);
  const [items, setItems] = React.useState<Picked[]>([]);
  // Save to: Job · Pre-Con · Daily Log (shared with the Voice note sheet).
  const targets = useMediaTargets();
  const [where, setWhere] = React.useState<MediaDestState>(EMPTY_DEST);
  const { dest, jobId, oppId, logTarget } = where;
  const [note, setNote] = React.useState("");
  const [clientVisible, setClientVisible] = React.useState(false);
  // Saving to a Job also files it in that job's daily log unless unticked,
  // so a site visit is logged without a second step.
  const [alsoLog, setAlsoLog] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveDone, setSaveDone] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState("");

  React.useEffect(() => {
    // eslint-disable-next-line -- one-time restore of the dismissed state on mount
    if (localStorage.getItem(STORAGE_KEY) === "1") setOpen(false);
  }, []);

  function setOpenPersist(v: boolean) {
    setOpen(v);
    localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
  }

  const isActive = (href?: string) => {
    if (!href) return false;
    const base = href.split("?")[0];
    return base !== "/" && pathname.startsWith(base);
  };

  async function ensureJobs() {
    await targets.load();
  }

  const destReady = isDestReady(where);
  const canShareWithClient = canShare(where);

  function openCapture() {
    setCaptureOpen(true);
    setMode(null); setItems([]); setWhere(EMPTY_DEST); setNote(""); setClientVisible(false); setSaveErr(""); setSaveDone(false);
  }

  // Add picked/captured files. `append` accumulates (gallery); otherwise replaces.
  function addFiles(e: React.ChangeEvent<HTMLInputElement>, kind: MediaKind, append: boolean) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const picked = files.map((file) => ({ file, url: URL.createObjectURL(file), kind }));
    setItems((prev) => (append ? [...prev, ...picked] : picked));
    void ensureJobs();
  }
  function removeItem(idx: number) {
    setItems((prev) => {
      const it = prev[idx];
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  /** Upload every picked file. Job uploads also land in that job's Files. */
  async function uploadAll(jobFolderFor: string | null, folder: string): Promise<{ url: string; type: MediaKind; name: string }[]> {
    const media: { url: string; type: MediaKind; name: string }[] = [];
    for (const it of items) {
      const fd = new FormData();
      fd.append("file", it.file, it.file.name || `${it.kind}-${Date.now()}`);
      fd.append("folder", folder);
      if (jobFolderFor) {
        fd.append("category", it.kind);
        const res = await fetch(`/api/jobs/${jobFolderFor}/files`, { method: "POST", body: fd });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Upload failed."); }
        const rec = await res.json();
        media.push({ url: rec.file_url, type: it.kind, name: rec.name });
      } else {
        const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.message || "Upload failed.");
        media.push({ url: j.url, type: it.kind, name: j.name });
      }
    }
    return media;
  }

  async function save() {
    if (!items.length || !destReady) return;
    setSaving(true); setSaveErr("");
    try {
      const kindLabel = items[0].kind === "video" ? "Video" : items.length > 1 ? "Photos" : "Photo";
      if (dest === "job") {
        const media = await uploadAll(jobId, items[0].kind === "video" ? "Job Videos" : "Job Photos");
        const firstImage = media.find((m) => m.type === "image");
        await fetch(`/api/jobs/${jobId}/updates`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: note.trim() ? note.trim().slice(0, 80) : `Job ${kindLabel}`,
            body: note.trim() || null,
            media,
            photo_url: firstImage?.url ?? null,
            update_type: "photo_update",
            visibility: clientVisible ? "client_visible" : "internal",
          }),
        });
        if (alsoLog) {
          const res = await fetch("/api/daily-logs", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targets: [{ kind: "job", id: jobId }],
              title: note.trim() ? note.trim().slice(0, 80) : `Site ${kindLabel.toLowerCase()}`,
              notes: note.trim() || null,
              photos: media.filter((m) => m.type === "image").map((m) => m.url),
              attachments: media.filter((m) => m.type === "video").map((m) => ({ url: m.url, type: "video", name: m.name })),
              client_visible: clientVisible,
            }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Saved to the job, but the daily log didn't save.");
        }
      } else if (dest === "precon") {
        const media = await uploadAll(null, `pre-con/${oppId}`);
        const res = await fetch(`/api/pipeline/${oppId}/media`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media, note }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed.");
      } else {
        const [kind, id] = logTarget.split(":") as ["job" | "opportunity", string];
        const media = await uploadAll(kind === "job" ? id : null, kind === "job" ? "Daily Log Photos" : `daily-logs/${id}`);
        const res = await fetch("/api/daily-logs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targets: [{ kind, id }],
            title: note.trim() ? note.trim().slice(0, 80) : `Site ${kindLabel.toLowerCase()}`,
            notes: note.trim() || null,
            photos: media.filter((m) => m.type === "image").map((m) => m.url),
            attachments: media.filter((m) => m.type === "video").map((m) => ({ url: m.url, type: "video", name: m.name })),
            client_visible: kind === "job" && clientVisible,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed.");
      }
      setSaveDone(true);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function closeCapture() {
    for (const it of items) URL.revokeObjectURL(it.url);
    setCaptureOpen(false); setMode(null); setItems([]); setSaveDone(false); setSaveErr(""); setWhere(EMPTY_DEST); setNote(""); setClientVisible(false);
  }

  const bar = !open ? (
    <button
      type="button"
      onClick={() => setOpenPersist(true)}
      className="fixed bottom-4 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg lg:hidden print:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ChevronUp className="h-4 w-4" /> Menu
    </button>
  ) : (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden print:hidden">
      <div className="flex items-stretch border-t border-border bg-card/95 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="flex flex-1 gap-1 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            const cls = cn(
              "flex min-w-[60px] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition",
              isActive(it.href) ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            );
            if (it.action) {
              return (
                <button key={it.label} type="button" onClick={it.action === "camera" ? openCapture : () => setRecorderOpen(true)} className={cls}>
                  <Icon className="h-5 w-5" />
                  {it.label}
                </button>
              );
            }
            return (
              <Link key={it.label} href={it.href!} className={cls}>
                <Icon className="h-5 w-5" />
                {it.label}
              </Link>
            );
          })}
        </div>
        <button type="button" onClick={() => setOpenPersist(false)} aria-label="Hide menu" className="flex shrink-0 items-center border-l border-border px-3 text-muted-foreground transition hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="bg-card/95" style={{ height: "env(safe-area-inset-bottom)" }} />
    </div>
  );

  return (
    <>
      {bar}
      <JobVoiceRecorder open={recorderOpen} onClose={() => setRecorderOpen(false)} />
      {/* Hidden capture inputs: single photo, gallery (shoot / choose), video */}
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { setMode("photo"); addFiles(e, "image", false); }} />
      <input ref={galleryCaptureRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e, "image", true)} />
      <input ref={galleryLibraryRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e, "image", true)} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { setMode("video"); addFiles(e, "video", false); }} />

      {captureOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4 lg:hidden" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{saveDone ? "Saved" : mode ? "Save media" : "Add media"}</h2>
              <button type="button" onClick={closeCapture} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {saveDone ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-accent" />
                <p className="text-sm font-medium">{items.length > 1 ? `${items.length} photos` : items[0]?.kind === "video" ? "Video" : "Photo"} {" "}{destPhrase(where)}{canShareWithClient && clientVisible ? " and shared with the client" : ""}.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={closeCapture} className="rounded-lg border border-border px-4 py-2 text-sm">Done</button>
                  <button type="button" onClick={openCapture} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Add more</button>
                </div>
              </div>
            ) : mode === null ? (
              // Step 1 — choose media type
              <div className="grid gap-2 p-4">
                <p className="mb-1 text-xs text-muted-foreground">What would you like to add?</p>
                <button type="button" onClick={() => photoRef.current?.click()} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-accent/5">
                  <ImageIcon className="h-5 w-5 shrink-0 text-accent" /><div className="min-w-0"><div className="text-sm font-semibold">Single Photo</div><div className="text-xs text-muted-foreground">Take one photo</div></div>
                </button>
                <button type="button" onClick={() => setMode("gallery")} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-accent/5">
                  <Images className="h-5 w-5 shrink-0 text-accent" /><div className="min-w-0"><div className="text-sm font-semibold">Photo Gallery</div><div className="text-xs text-muted-foreground">Take or choose multiple photos</div></div>
                </button>
                <button type="button" onClick={() => videoRef.current?.click()} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-accent/5">
                  <Video className="h-5 w-5 shrink-0 text-accent" /><div className="min-w-0"><div className="text-sm font-semibold">Video</div><div className="text-xs text-muted-foreground">Record a video</div></div>
                </button>
              </div>
            ) : (
              // Step 2 — preview, assign, notes, visibility, save
              <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
                {mode === "video" && items[0] ? (
                  <video src={items[0].url} controls className="max-h-56 w-full rounded-lg border border-border" />
                ) : mode === "photo" && items[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={items[0].url} alt="" className="max-h-56 w-full rounded-lg border border-border object-contain" />
                ) : mode === "gallery" ? (
                  <div className="space-y-2">
                    {items.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {items.map((it, i) => (
                          <div key={i} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={it.url} alt="" className="aspect-square w-full rounded-lg border border-border object-cover" />
                            <button type="button" onClick={() => removeItem(i)} aria-label="Remove photo" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"><X className="h-3 w-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => galleryCaptureRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"><Camera className="h-4 w-4" /> Take photo</button>
                      <button type="button" onClick={() => galleryLibraryRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"><Images className="h-4 w-4" /> Choose photos</button>
                    </div>
                    <p className="text-xs text-muted-foreground">{items.length ? `${items.length} photo${items.length > 1 ? "s" : ""} added` : "Take or choose photos to build this gallery."}</p>
                  </div>
                ) : null}

                <MediaDestinationPicker value={where} onChange={setWhere} jobs={targets.jobs} opps={targets.opps} loaded={targets.loaded} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes / summary (optional)</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Describe this media…" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
                </div>
                {dest === "job" && (
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <input type="checkbox" checked={alsoLog} onChange={(e) => setAlsoLog(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                    <span>Also add to today&apos;s daily log</span>
                  </label>
                )}
                {canShareWithClient && <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Visible to client <span className="text-muted-foreground">— posts to the client portal</span></span>
                </label>}
                {saveErr && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">{saveErr}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={closeCapture} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold transition hover:bg-muted">Cancel</button>
                  <button type="button" onClick={() => void save()} disabled={!destReady || saving || items.length === 0} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
