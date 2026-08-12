"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Camera, CheckCircle2, ChevronUp, Eye, HardHat, Home, IdCard, Image as ImageIcon, Images, Loader2, Mail, Mic, Package, Phone, Sparkles, Users, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobVoiceRecorder } from "./job-voice-recorder";

// Fixed, horizontally-scrollable quick-nav for mobile/tablet. Dismissable, with
// the closed state remembered. Hidden on desktop (the sidebar covers that).
type NavItem = { label: string; icon: typeof Home; href?: string; action?: "camera" | "record" };
const ITEMS: NavItem[] = [
  { href: "/dashboard/overview", label: "Dashboard", icon: Home },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/selections", label: "Selections", icon: Package },
  { href: "/dashboard/jobs", label: "Jobs", icon: HardHat },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/dashboard/communications?panel=dialer", label: "Call", icon: Phone },
  { href: "/dashboard/communications?panel=email", label: "Email", icon: Mail },
  { action: "record", label: "Record", icon: Mic },
  { action: "camera", label: "Camera", icon: Camera },
  { href: "/dashboard/business-cards", label: "Cards", icon: IdCard },
  { href: "/dashboard/agent", label: "Bolt", icon: Sparkles },
];

const STORAGE_KEY = "cmi_mobilenav_closed";
type JobOpt = { id: string; label: string };
type MediaKind = "image" | "video";
type Picked = { file: File; url: string; kind: MediaKind };

export function MobileBottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);

  const photoRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLInputElement>(null);

  const [recorderOpen, setRecorderOpen] = React.useState(false);

  // Media capture state
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [items, setItems] = React.useState<Picked[]>([]);
  const [jobs, setJobs] = React.useState<JobOpt[]>([]);
  const [jobsLoaded, setJobsLoaded] = React.useState(false);
  const [jobId, setJobId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [clientVisible, setClientVisible] = React.useState(false);
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
    if (jobsLoaded) return;
    try {
      const rows = await fetch("/api/jobs").then((r) => r.json());
      if (Array.isArray(rows)) setJobs(rows.map((r: { id: string; job_number?: string; job_name?: string }) => ({ id: r.id, label: [r.job_number, r.job_name].filter(Boolean).join(" · ") || r.job_name || "Job" })));
      setJobsLoaded(true);
    } catch { /* modal shows empty state */ }
  }

  function openCapture() {
    setCaptureOpen(true);
    setItems([]); setJobId(""); setNote(""); setClientVisible(false); setSaveErr(""); setSaveDone(false);
  }

  function onPicked(kind: MediaKind, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setItems(files.map((file) => ({ file, url: URL.createObjectURL(file), kind })));
    void ensureJobs();
  }

  async function save() {
    if (!items.length || !jobId) return;
    setSaving(true); setSaveErr("");
    try {
      const media: { url: string; type: MediaKind; name: string }[] = [];
      for (const it of items) {
        const fd = new FormData();
        fd.append("file", it.file, it.file.name || `${it.kind}-${Date.now()}`);
        fd.append("folder", it.kind === "video" ? "Job Videos" : "Job Photos");
        fd.append("category", it.kind);
        const res = await fetch(`/api/jobs/${jobId}/files`, { method: "POST", body: fd });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Upload failed."); }
        const rec = await res.json();
        media.push({ url: rec.file_url, type: it.kind, name: rec.name });
      }
      const firstImage = media.find((m) => m.type === "image");
      const kindLabel = items[0].kind === "video" ? "Video" : items.length > 1 ? "Photos" : "Photo";
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
      setSaveDone(true);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function closeCapture() {
    for (const it of items) URL.revokeObjectURL(it.url);
    setCaptureOpen(false); setItems([]); setSaveDone(false); setSaveErr(""); setJobId(""); setNote(""); setClientVisible(false);
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
      {/* Hidden capture inputs: single photo, photo gallery, video */}
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPicked("image", e)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPicked("image", e)} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => onPicked("video", e)} />

      {captureOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 lg:hidden" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{saveDone ? "Added to job" : items.length ? "Attach to a job" : "Add media"}</h2>
              <button type="button" onClick={closeCapture} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {saveDone ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-accent" />
                <p className="text-sm font-medium">{items.length > 1 ? `${items.length} photos` : items[0]?.kind === "video" ? "Video" : "Photo"} added to the job{clientVisible ? " and shared with the client" : ""}.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={closeCapture} className="rounded-lg border border-border px-4 py-2 text-sm">Done</button>
                  <button type="button" onClick={openCapture} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Add more</button>
                </div>
              </div>
            ) : items.length === 0 ? (
              // Step 1 — choose media type
              <div className="grid gap-2 p-4">
                <p className="mb-1 text-xs text-muted-foreground">What would you like to add?</p>
                <button type="button" onClick={() => photoRef.current?.click()} className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-accent/5">
                  <ImageIcon className="h-5 w-5 shrink-0 text-accent" /><div><div className="text-sm font-semibold">Single Photo</div><div className="text-xs text-muted-foreground">Take one photo</div></div>
                </button>
                <button type="button" onClick={() => galleryRef.current?.click()} className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-accent/5">
                  <Images className="h-5 w-5 shrink-0 text-accent" /><div><div className="text-sm font-semibold">Photo Gallery</div><div className="text-xs text-muted-foreground">Select multiple photos</div></div>
                </button>
                <button type="button" onClick={() => videoRef.current?.click()} className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-accent/5">
                  <Video className="h-5 w-5 shrink-0 text-accent" /><div><div className="text-sm font-semibold">Video</div><div className="text-xs text-muted-foreground">Record a video</div></div>
                </button>
              </div>
            ) : (
              // Step 2 — preview, assign, notes, visibility, save
              <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
                {items[0].kind === "video" ? (
                  <video src={items[0].url} controls className="max-h-56 w-full rounded-lg border border-border" />
                ) : items.length === 1 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={items[0].url} alt="" className="max-h-56 w-full rounded-lg border border-border object-contain" />
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((it, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={it.url} alt="" className="aspect-square w-full rounded-lg border border-border object-cover" />
                    ))}
                  </div>
                )}
                {items.length > 1 && <p className="text-xs text-muted-foreground">{items.length} photos selected</p>}

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Attach to job</label>
                  <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
                    <option value="">Select a job…</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                  </select>
                  {jobsLoaded && jobs.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No jobs available.</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes / summary (optional)</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Describe this media…" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Visible to client <span className="text-muted-foreground">— posts to the client portal</span></span>
                </label>
                {saveErr && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">{saveErr}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={closeCapture} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold transition hover:bg-muted">Cancel</button>
                  <button type="button" onClick={() => void save()} disabled={!jobId || saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
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
