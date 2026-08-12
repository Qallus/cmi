"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Camera, CheckCircle2, ChevronUp, Eye, HardHat, Home, IdCard, Loader2, Mail, Mic, Package, Phone, Sparkles, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Fixed, horizontally-scrollable quick-nav for mobile/tablet. Dismissable, with
// the closed state remembered. Hidden on desktop (the sidebar covers that).
type NavItem = { label: string; icon: typeof Home; href?: string; action?: "camera" };
const ITEMS: NavItem[] = [
  { href: "/dashboard/overview", label: "Dashboard", icon: Home },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/selections", label: "Selections", icon: Package },
  { href: "/dashboard/jobs", label: "Jobs", icon: HardHat },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/dashboard/communications?panel=dialer", label: "Call", icon: Phone },
  { href: "/dashboard/communications?panel=email", label: "Email", icon: Mail },
  { href: "/dashboard/recording-studio", label: "Record", icon: Mic },
  { action: "camera", label: "Camera", icon: Camera },
  { href: "/dashboard/business-cards", label: "Cards", icon: IdCard },
  { href: "/dashboard/agent", label: "Bolt", icon: Sparkles },
];

const STORAGE_KEY = "cmi_mobilenav_closed";
type JobOpt = { id: string; label: string };

export function MobileBottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Camera → job photo capture state
  const [photo, setPhoto] = React.useState<{ file: File; url: string } | null>(null);
  const [jobs, setJobs] = React.useState<JobOpt[]>([]);
  const [jobsLoaded, setJobsLoaded] = React.useState(false);
  const [jobId, setJobId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [clientVisible, setClientVisible] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadDone, setUploadDone] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState("");

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

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhoto({ file, url: URL.createObjectURL(file) });
    setJobId(""); setNote(""); setClientVisible(false); setUploadErr(""); setUploadDone(false);
    if (!jobsLoaded) {
      try {
        const rows = await fetch("/api/jobs").then((r) => r.json());
        if (Array.isArray(rows)) setJobs(rows.map((r: { id: string; job_number?: string; job_name?: string }) => ({ id: r.id, label: [r.job_number, r.job_name].filter(Boolean).join(" · ") || r.job_name || "Job" })));
        setJobsLoaded(true);
      } catch { /* modal shows empty state */ }
    }
  }

  // Always store the photo in the job's Files (so it's visible in the
  // dashboard); when adding as a Note, or when marked client-visible, also
  // post a job update carrying the photo + description.
  async function submit(destination: "job" | "notes") {
    if (!photo || !jobId) return;
    setUploading(true); setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", photo.file, photo.file.name || `photo-${Date.now()}.jpg`);
      fd.append("folder", "Job Photos");
      fd.append("category", "photo");
      const fres = await fetch(`/api/jobs/${jobId}/files`, { method: "POST", body: fd });
      if (!fres.ok) { const j = await fres.json().catch(() => ({})); throw new Error(j.error || "Upload failed."); }
      const fileRec = await fres.json();

      if (destination === "notes" || clientVisible) {
        await fetch(`/api/jobs/${jobId}/updates`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: note.trim() ? note.trim().slice(0, 80) : "Job photo",
            body: note.trim() || null,
            photo_url: fileRec.file_url,
            update_type: "photo_update",
            visibility: clientVisible ? "client_visible" : "internal",
          }),
        });
      }
      setUploadDone(true);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function closeCapture() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null); setUploadDone(false); setUploadErr(""); setJobId(""); setNote(""); setClientVisible(false);
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
            if (it.action === "camera") {
              return (
                <button key={it.label} type="button" onClick={() => fileRef.current?.click()} className={cls}>
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
      {/* Device camera → capture a photo (rear camera on phones) */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFilePicked} />

      {/* Capture → attach to job */}
      {photo && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 lg:hidden" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Add photo to a job</h2>
              <button type="button" onClick={closeCapture} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {uploadDone ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-accent" />
                <p className="text-sm font-medium">Photo added to the job.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={closeCapture} className="rounded-lg border border-border px-4 py-2 text-sm">Done</button>
                  <button type="button" onClick={() => { closeCapture(); fileRef.current?.click(); }} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Take another</button>
                </div>
              </div>
            ) : (
              <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Captured" className="max-h-56 w-full rounded-lg border border-border object-contain" />
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Attach to job</label>
                  <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
                    <option value="">Select a job…</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                  </select>
                  {jobsLoaded && jobs.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No jobs available.</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Describe this photo…" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Visible to client <span className="text-muted-foreground">— posts to the client portal</span></span>
                </label>
                {uploadErr && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">{uploadErr}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => void submit("job")} disabled={!jobId || uploading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold transition hover:border-accent hover:text-accent disabled:opacity-60">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardHat className="h-4 w-4" />} Add to Job
                  </button>
                  <button type="button" onClick={() => void submit("notes")} disabled={!jobId || uploading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Add to Notes
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
