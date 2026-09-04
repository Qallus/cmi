"use client";

import * as React from "react";
import {
  Cloud, Upload, FolderPlus, Folder, File as FileIcon, FileText, Image as ImageIcon, Film, Music,
  FileArchive, Search, LayoutGrid, List as ListIcon, MoreVertical, Download, Pencil, Trash2,
  RotateCcw, X, ChevronRight, Loader2, HardDrive, Camera, Check, Link2, Home, CloudOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FileRow, FolderRow } from "@/lib/files/types";

export type ProjectOption = { id: string; title: string };
type ViewKey = "all" | "general" | "my" | "recent" | "trash" | `project:${string}`;
type Crumb = { id: string; name: string };

const fmtSize = (n: number | null | undefined) => {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

function fileKind(mime: string | null): "image" | "video" | "audio" | "pdf" | "archive" | "doc" | "other" {
  const m = mime || "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (m.includes("zip") || m.includes("compressed")) return "archive";
  if (m.includes("word") || m.includes("sheet") || m.includes("presentation") || m.startsWith("text/")) return "doc";
  return "other";
}
function KindIcon({ mime, className }: { mime: string | null; className?: string }) {
  const k = fileKind(mime);
  const Icon = k === "image" ? ImageIcon : k === "video" ? Film : k === "audio" ? Music : k === "pdf" ? FileText : k === "archive" ? FileArchive : k === "doc" ? FileText : FileIcon;
  const tint = k === "image" ? "text-emerald-500" : k === "video" ? "text-purple-500" : k === "pdf" ? "text-red-500" : k === "audio" ? "text-amber-500" : "text-muted-foreground";
  return <Icon className={cn(className, tint)} />;
}

// PUT a blob with progress; resolves the ETag response header (for multipart).
function putWithProgress(url: string, body: Blob, contentType: string, onProgress?: (loaded: number) => void, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => { if (onProgress) onProgress(e.loaded); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve((xhr.getResponseHeader("ETag") || "").replace(/"/g, "")) : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    if (signal) signal.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

// Client-side thumbnail (≤400px JPEG) for images.
async function makeThumb(file: File): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.7));
  } catch { return null; }
}

type UploadTask = { id: string; name: string; progress: number; status: "uploading" | "done" | "error" | "canceled"; error?: string; ctrl: AbortController };

export function CloudClient({ projects, meId, storageOnline }: { projects: ProjectOption[]; meId: string | null; storageOnline: boolean }) {
  const [view, setView] = React.useState<ViewKey>("all");
  const [path, setPath] = React.useState<Crumb[]>([]);
  const [folders, setFolders] = React.useState<FolderRow[]>([]);
  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [layout, setLayout] = React.useState<"grid" | "list">("grid");
  const [sort, setSort] = React.useState<"name" | "modified" | "size">("name");
  const [query, setQuery] = React.useState("");
  const [storageUsed, setStorageUsed] = React.useState(0);
  const [online, setOnline] = React.useState(storageOnline);
  const [uploads, setUploads] = React.useState<UploadTask[]>([]);
  const [preview, setPreview] = React.useState<FileRow | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [projectsOpen, setProjectsOpen] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const folderId = path.length ? path[path.length - 1].id : null;
  const isBrowse = !["my", "recent", "trash"].includes(view);
  const scopeProject: string | null = view === "all" || view.startsWith("my") || view === "recent" || view === "trash"
    ? null : view === "general" ? null : view.startsWith("project:") ? view.slice(8) : null;
  const canModify = React.useCallback((row: { uploaded_by?: string | null; created_by?: string | null }) => (row.uploaded_by ?? row.created_by) === meId, [meId]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (view === "my") params.set("view", "my");
    else if (view === "recent") params.set("view", "recent");
    else if (view === "trash") params.set("view", "trash");
    else if (view === "general") { params.set("project", "general"); if (folderId) params.set("folder", folderId); }
    else if (view.startsWith("project:")) { params.set("project", view.slice(8)); if (folderId) params.set("folder", folderId); }
    else if (folderId) params.set("folder", folderId); // "all" + inside a folder
    const res = await fetch(`/api/files?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      setFolders(j.folders ?? []); setFiles(j.files ?? []); setStorageUsed(j.storageUsed ?? 0); setOnline(j.storageOnline ?? true);
    }
    setLoading(false);
  }, [view, folderId]);
  // Defer to a microtask so load()'s synchronous setLoading isn't flagged as a
  // synchronous setState inside the effect (and to debounce rapid view changes).
  React.useEffect(() => { const id = setTimeout(() => void load(), 0); return () => clearTimeout(id); }, [load]);

  function switchView(v: ViewKey) { setView(v); setPath([]); setQuery(""); }

  const sorted = React.useMemo(() => {
    const cmp = (a: { name: string; updated_at: string; size_bytes?: number | null }, b: typeof a) =>
      sort === "name" ? a.name.localeCompare(b.name)
      : sort === "modified" ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      : (b.size_bytes ?? 0) - (a.size_bytes ?? 0);
    return { folders: [...folders].sort((a, b) => a.name.localeCompare(b.name)), files: [...files].sort(cmp) };
  }, [folders, files, sort]);

  // ── Uploads ──
  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    for (const file of arr) {
      const id = crypto.randomUUID();
      const ctrl = new AbortController();
      setUploads((u) => [...u, { id, name: file.name, progress: 0, status: "uploading", ctrl }]);
      void runUpload(file, id, ctrl).catch((e) => setUploads((u) => u.map((t) => t.id === id ? { ...t, status: "error", error: e instanceof Error ? e.message : "Failed" } : t)));
    }
  }

  async function runUpload(file: File, taskId: string, ctrl: AbortController) {
    const setProg = (p: number) => setUploads((u) => u.map((t) => t.id === taskId ? { ...t, progress: p } : t));
    const isImage = file.type.startsWith("image/");
    const presign = await fetch("/api/files/presign-upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, mime: file.type || "application/octet-stream", projectId: scopeProject, folderId: isBrowse ? folderId : null, withThumb: isImage }),
    }).then((r) => r.json());
    if (presign.error) throw new Error(presign.error);

    let thumbnailKey: string | null = null;
    if (presign.thumbUrl) { const thumb = await makeThumb(file); if (thumb) { try { await putWithProgress(presign.thumbUrl, thumb, "image/jpeg", undefined, ctrl.signal); thumbnailKey = presign.thumbKey; } catch { /* thumb optional */ } } }

    const commonBody = { key: presign.key, name: file.name, mime: file.type, size: file.size, projectId: scopeProject, folderId: isBrowse ? folderId : null, thumbnailKey };

    if (presign.mode === "single") {
      await putWithProgress(presign.url, file, file.type || "application/octet-stream", (loaded) => setProg(Math.round((loaded / file.size) * 100)), ctrl.signal);
      const r = await fetch("/api/files/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(commonBody) });
      if (!r.ok) throw new Error((await r.json()).error || "Finalize failed.");
    } else {
      const parts: { partNumber: number; url: string }[] = presign.parts;
      const partSize: number = presign.partSize;
      const loaded = new Array(parts.length).fill(0);
      const etags = new Array<{ PartNumber: number; ETag: string }>(parts.length);
      try {
        await runPool(parts, 3, async (p) => {
          const start = (p.partNumber - 1) * partSize;
          const chunk = file.slice(start, Math.min(start + partSize, file.size));
          const etag = await putWithProgress(p.url, chunk, file.type || "application/octet-stream", (l) => { loaded[p.partNumber - 1] = l; setProg(Math.round((loaded.reduce((a, b) => a + b, 0) / file.size) * 100)); }, ctrl.signal);
          etags[p.partNumber - 1] = { PartNumber: p.partNumber, ETag: etag };
        });
        const r = await fetch("/api/files/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...commonBody, multipart: { uploadId: presign.uploadId, parts: etags } }) });
        if (!r.ok) throw new Error((await r.json()).error || "Finalize failed.");
      } catch (e) {
        fetch("/api/files/abort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: presign.key, uploadId: presign.uploadId }) }).catch(() => {});
        throw e;
      }
    }
    setUploads((u) => u.map((t) => t.id === taskId ? { ...t, status: "done", progress: 100 } : t));
    void load();
  }

  // ── Actions ──
  async function newFolder() {
    const name = window.prompt("New folder name:");
    if (!name?.trim()) return;
    await fetch("/api/files/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, project_id: scopeProject, parent_id: isBrowse ? folderId : null }) });
    void load();
  }
  async function renameItem(kind: "file" | "folder", id: string, current: string) {
    const name = window.prompt("Rename to:", current);
    if (!name?.trim() || name === current) return;
    await fetch(`/api/files/${kind === "folder" ? "folders/" : ""}${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    void load();
  }
  async function trashItem(kind: "file" | "folder", id: string) {
    await fetch(`/api/files/${kind === "folder" ? "folders/" : ""}${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trash: true }) });
    void load();
  }
  async function restoreItem(kind: "file" | "folder", id: string) {
    await fetch(`/api/files/${kind === "folder" ? "folders/" : ""}${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restore: true }) });
    void load();
  }
  async function deleteForever(kind: "file" | "folder", id: string) {
    if (!window.confirm(kind === "folder" ? "Delete this folder and everything in it? This cannot be undone." : "Delete this file permanently? This cannot be undone.")) return;
    await fetch(`/api/files/${kind === "folder" ? "folders/" : ""}${id}`, { method: "DELETE" });
    void load();
  }
  async function downloadFile(f: FileRow) {
    const r = await fetch(`/api/files/${f.id}/url?download=1`);
    if (r.ok) { const { url } = await r.json(); window.open(url, "_blank", "noopener"); }
  }
  async function copyLink(f: FileRow) {
    const r = await fetch(`/api/files/${f.id}/url`);
    if (r.ok) { const { url } = await r.json(); try { await navigator.clipboard.writeText(url); } catch { /* ignore */ } }
  }

  // ── Drag & drop ──
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    if (!online) return;
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  const activeUploads = uploads.filter((u) => u.status === "uploading").length;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col lg:flex-row" onDragOver={(e) => { if (online) { e.preventDefault(); setDragOver(true); } }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      {/* Left panel */}
      <aside className="shrink-0 border-b border-border bg-card lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-3.5"><Cloud className="h-5 w-5 text-accent" /><span className="font-display text-lg font-semibold">Cloud</span></div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          <NavBtn active={view === "my"} icon={FileIcon} label="My Uploads" onClick={() => switchView("my")} />
          <NavBtn active={view === "all"} icon={HardDrive} label="All Files" onClick={() => switchView("all")} />
          <NavBtn active={view === "general"} icon={Folder} label="General" onClick={() => switchView("general")} />
          <NavBtn active={view === "recent"} icon={Clock3Fallback} label="Recent" onClick={() => switchView("recent")} />
          <NavBtn active={view === "trash"} icon={Trash2} label="Trash" onClick={() => switchView("trash")} />
        </nav>
        {/* Projects (expandable) */}
        <div className="hidden px-2 lg:block">
          <button onClick={() => setProjectsOpen((v) => !v)} className="flex w-full items-center justify-between rounded-md px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted">
            Projects <ChevronRight className={cn("h-3.5 w-3.5 transition", projectsOpen && "rotate-90")} />
          </button>
          {projectsOpen && (
            <div className="max-h-64 space-y-0.5 overflow-y-auto pb-2">
              {projects.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">No projects.</p>
                : projects.map((p) => <NavBtn key={p.id} small active={view === `project:${p.id}`} icon={Folder} label={p.title} onClick={() => switchView(`project:${p.id}`)} />)}
            </div>
          )}
        </div>
        {/* Storage used */}
        <div className="mt-auto hidden px-4 py-3 lg:block">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><HardDrive className="h-3 w-3" /> {fmtSize(storageUsed)} used</div>
          {!online && <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400"><CloudOff className="h-3 w-3" /> Storage offline</div>}
        </div>
      </aside>

      {/* Main */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
            <button onClick={() => setPath([])} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Home className="h-3.5 w-3.5" /></button>
            {path.map((c, i) => (
              <span key={c.id} className="inline-flex min-w-0 items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <button onClick={() => setPath(path.slice(0, i + 1))} className="truncate rounded px-1 py-0.5 hover:bg-muted">{c.name}</button>
              </span>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) { setView("all"); void searchNow(query, setFolders, setFiles, setLoading); } }} placeholder="Search files…" className="w-40 pl-8 sm:w-56" />
          </div>
          <div className="flex overflow-hidden rounded-md border border-border">
            <button onClick={() => setLayout("grid")} className={cn("grid h-8 w-8 place-items-center", layout === "grid" ? "bg-accent text-accent-foreground" : "hover:bg-muted")}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setLayout("list")} className={cn("grid h-8 w-8 place-items-center", layout === "list" ? "bg-accent text-accent-foreground" : "hover:bg-muted")}><ListIcon className="h-4 w-4" /></button>
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            <option value="name">Name</option><option value="modified">Modified</option><option value="size">Size</option>
          </select>
          {isBrowse && online && (
            <>
              <Button size="sm" variant="outline" onClick={newFolder}><FolderPlus className="h-4 w-4" /> <span className="hidden sm:inline">New folder</span></Button>
              <Button size="sm" variant="accent" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Upload</Button>
              <Button size="sm" variant="outline" className="lg:hidden" onClick={() => cameraInputRef.current?.click()}><Camera className="h-4 w-4" /></Button>
            </>
          )}
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.currentTarget.value = ""; }} />
          <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.currentTarget.value = ""; }} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {!online ? (
            <EmptyState icon={CloudOff} title="Files are temporarily unavailable" note="The office storage server is unreachable. The rest of the dashboard still works — try again shortly." />
          ) : loading ? (
            <div className={cn(layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" : "space-y-1")}>
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className={cn("animate-pulse rounded-lg bg-muted", layout === "grid" ? "aspect-square" : "h-12")} />)}
            </div>
          ) : sorted.folders.length === 0 && sorted.files.length === 0 ? (
            <EmptyState icon={view === "trash" ? Trash2 : Cloud} title={view === "trash" ? "Trash is empty" : "No files yet"} note={view === "trash" ? "Deleted files and folders appear here." : isBrowse ? "Drag files here, or use the Upload button to get started." : "Nothing to show."} />
          ) : layout === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {sorted.folders.map((f) => (
                <GridTile key={f.id} onOpen={() => view === "trash" ? undefined : setPath([...path, { id: f.id, name: f.name }])}
                  icon={<Folder className="h-10 w-10 text-accent" />} name={f.name} sub="Folder"
                  menu={<ItemMenu open={menuFor === f.id} onToggle={() => setMenuFor(menuFor === f.id ? null : f.id)} trash={view === "trash"} canModify={canModify(f)}
                    onRename={() => renameItem("folder", f.id, f.name)} onTrash={() => trashItem("folder", f.id)} onRestore={() => restoreItem("folder", f.id)} onDelete={() => deleteForever("folder", f.id)} />} />
              ))}
              {sorted.files.map((f) => (
                <GridTile key={f.id} onOpen={() => view === "trash" ? undefined : setPreview(f)}
                  icon={f.thumbnail_key ? <FileThumb id={f.id} mime={f.mime_type} /> : <KindIcon mime={f.mime_type} className="h-10 w-10" />}
                  name={f.name} sub={fmtSize(f.size_bytes)}
                  menu={<ItemMenu open={menuFor === f.id} onToggle={() => setMenuFor(menuFor === f.id ? null : f.id)} trash={view === "trash"} canModify={canModify(f)}
                    onPreview={() => setPreview(f)} onDownload={() => downloadFile(f)} onCopyLink={() => copyLink(f)} onRename={() => renameItem("file", f.id, f.name)} onTrash={() => trashItem("file", f.id)} onRestore={() => restoreItem("file", f.id)} onDelete={() => deleteForever("file", f.id)} />} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2 hidden sm:table-cell">Modified</th><th className="px-3 py-2 text-right">Size</th><th className="w-10" /></tr></thead>
                <tbody>
                  {sorted.folders.map((f) => (
                    <tr key={f.id} className="border-t border-border hover:bg-muted/40">
                      <td className="cursor-pointer px-3 py-2 font-medium" onClick={() => view !== "trash" && setPath([...path, { id: f.id, name: f.name }])}><span className="inline-flex items-center gap-2"><Folder className="h-4 w-4 text-accent" /> {f.name}</span></td>
                      <td className="px-3 py-2 hidden text-muted-foreground sm:table-cell">{fmtDate(f.updated_at)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                      <td className="px-3 py-2"><ItemMenu open={menuFor === f.id} onToggle={() => setMenuFor(menuFor === f.id ? null : f.id)} trash={view === "trash"} canModify={canModify(f)} onRename={() => renameItem("folder", f.id, f.name)} onTrash={() => trashItem("folder", f.id)} onRestore={() => restoreItem("folder", f.id)} onDelete={() => deleteForever("folder", f.id)} /></td>
                    </tr>
                  ))}
                  {sorted.files.map((f) => (
                    <tr key={f.id} className="border-t border-border hover:bg-muted/40">
                      <td className="cursor-pointer px-3 py-2 font-medium" onClick={() => view !== "trash" && setPreview(f)}><span className="inline-flex items-center gap-2"><KindIcon mime={f.mime_type} className="h-4 w-4" /> {f.name}</span></td>
                      <td className="px-3 py-2 hidden text-muted-foreground sm:table-cell">{fmtDate(f.updated_at)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{fmtSize(f.size_bytes)}</td>
                      <td className="px-3 py-2"><ItemMenu open={menuFor === f.id} onToggle={() => setMenuFor(menuFor === f.id ? null : f.id)} trash={view === "trash"} canModify={canModify(f)} onPreview={() => setPreview(f)} onDownload={() => downloadFile(f)} onCopyLink={() => copyLink(f)} onRename={() => renameItem("file", f.id, f.name)} onTrash={() => trashItem("file", f.id)} onRestore={() => restoreItem("file", f.id)} onDelete={() => deleteForever("file", f.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drag overlay */}
        {dragOver && online && (
          <div className="pointer-events-none absolute inset-0 z-20 m-3 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent/5">
            <div className="text-center"><Upload className="mx-auto mb-2 h-8 w-8 text-accent" /><p className="font-medium text-accent">Drop files to upload</p></div>
          </div>
        )}
      </div>

      {/* Upload tray */}
      {uploads.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium">
            <span>{activeUploads > 0 ? `Uploading ${activeUploads}…` : "Uploads"}</span>
            <button onClick={() => setUploads((u) => u.filter((t) => t.status === "uploading"))} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-64 divide-y divide-border overflow-auto">
            {uploads.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.name}</div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", t.status === "error" ? "bg-destructive" : "bg-accent")} style={{ width: `${t.progress}%` }} /></div>
                </div>
                {t.status === "uploading" ? <button onClick={() => { t.ctrl.abort(); setUploads((u) => u.map((x) => x.id === t.id ? { ...x, status: "canceled" } : x)); }} title="Cancel"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  : t.status === "done" ? <Check className="h-4 w-4 text-emerald-500" />
                  : t.status === "error" ? <button title={t.error} onClick={() => void 0}><span className="text-destructive">!</span></button>
                  : <span className="text-muted-foreground">—</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} onDownload={() => downloadFile(preview)} />}
    </div>
  );
}

// Fallback for the Recent icon (avoid extra import churn).
function Clock3Fallback(props: { className?: string }) { return <RotateCcw {...props} />; }

async function searchNow(q: string, setFolders: (f: FolderRow[]) => void, setFiles: (f: FileRow[]) => void, setLoading: (b: boolean) => void) {
  setLoading(true);
  const r = await fetch(`/api/files?view=search&q=${encodeURIComponent(q)}`);
  if (r.ok) { const j = await r.json(); setFolders([]); setFiles(j.files ?? []); }
  setLoading(false);
}

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) { const it = queue.shift(); if (it !== undefined) await fn(it); }
  }));
}

function NavBtn({ icon: Icon, label, active, onClick, small }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition lg:w-full", small && "py-1.5 text-[13px]", active ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{label}</span>
    </button>
  );
}

function GridTile({ icon, name, sub, onOpen, menu }: { icon: React.ReactNode; name: string; sub: string; onOpen?: () => void; menu: React.ReactNode }) {
  return (
    <div className="group relative rounded-lg border border-border bg-card p-3 transition hover:border-accent/40 hover:shadow-sm">
      <button onClick={onOpen} className="flex w-full flex-col items-center gap-2">
        <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-muted/40">{icon}</div>
        <div className="w-full truncate text-center text-xs font-medium">{name}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </button>
      <div className="absolute right-1.5 top-1.5">{menu}</div>
    </div>
  );
}

function FileThumb({ id, mime }: { id: string; mime: string | null }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => { let a = true; (async () => { const r = await fetch(`/api/files/${id}/url`); if (r.ok && a) setUrl((await r.json()).url); })(); return () => { a = false; }; }, [id]);
  // The presigned GET points at the object; thumbnails share the same auth path via a separate key,
  // so for the grid we just show the full image scaled (browser caches it) or the type icon while loading.
  // eslint-disable-next-line @next/next/no-img-element -- presigned Garage URL, not optimizable by next/image
  return url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <KindIcon mime={mime} className="h-10 w-10" />;
}

function ItemMenu({ open, onToggle, trash, canModify, onPreview, onDownload, onCopyLink, onRename, onTrash, onRestore, onDelete }: {
  open: boolean; onToggle: () => void; trash: boolean; canModify: boolean;
  onPreview?: () => void; onDownload?: () => void; onCopyLink?: () => void; onRename?: () => void; onTrash?: () => void; onRestore?: () => void; onDelete?: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onToggle(); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open, onToggle]);
  return (
    <div ref={ref} className="relative">
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="grid h-7 w-7 place-items-center rounded-md bg-card/80 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[open=true]:opacity-100" data-open={open}><MoreVertical className="h-4 w-4" /></button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
          {trash ? (
            <>
              <MenuItem icon={RotateCcw} label="Restore" onClick={() => { onToggle(); onRestore?.(); }} disabled={!canModify} />
              <MenuItem icon={Trash2} label="Delete forever" danger onClick={() => { onToggle(); onDelete?.(); }} disabled={!canModify} />
            </>
          ) : (
            <>
              {onPreview && <MenuItem icon={ImageIcon} label="Preview" onClick={() => { onToggle(); onPreview(); }} />}
              {onDownload && <MenuItem icon={Download} label="Download" onClick={() => { onToggle(); onDownload(); }} />}
              {onCopyLink && <MenuItem icon={Link2} label="Copy link" onClick={() => { onToggle(); onCopyLink(); }} />}
              <MenuItem icon={Pencil} label="Rename" onClick={() => { onToggle(); onRename?.(); }} disabled={!canModify} />
              <MenuItem icon={Trash2} label="Move to trash" danger onClick={() => { onToggle(); onTrash?.(); }} disabled={!canModify} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
function MenuItem({ icon: Icon, label, onClick, danger, disabled }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition disabled:opacity-40", danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted")}><Icon className="h-3.5 w-3.5" /> {label}</button>;
}

function PreviewModal({ file, onClose, onDownload }: { file: FileRow; onClose: () => void; onDownload: () => void }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const kind = fileKind(file.mime_type);
  React.useEffect(() => { let a = true; (async () => { const r = await fetch(`/api/files/${file.id}/url`); if (r.ok && a) setUrl((await r.json()).url); })(); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => { a = false; window.removeEventListener("keydown", onKey); }; }, [file.id, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2"><KindIcon mime={file.mime_type} className="h-4 w-4 shrink-0" /><span className="truncate font-medium">{file.name}</span></div>
          <div className="flex items-center gap-1">
            <button onClick={onDownload} title="Download" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><Download className="h-4 w-4" /></button>
            <button onClick={onClose} title="Close" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/30 p-4">
          {!url ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            /* eslint-disable-next-line @next/next/no-img-element -- presigned Garage URL */
            : kind === "image" ? <img src={url} alt={file.name} className="max-h-[75vh] max-w-full object-contain" />
            : kind === "video" ? <video src={url} controls className="max-h-[75vh] max-w-full" />
            : kind === "audio" ? <audio src={url} controls className="w-full" />
            : kind === "pdf" ? <iframe src={url} title={file.name} className="h-[75vh] w-full rounded-md border border-border bg-white" />
            : <div className="text-center"><KindIcon mime={file.mime_type} className="mx-auto mb-3 h-12 w-12" /><p className="text-sm text-muted-foreground">{fmtSize(file.size_bytes)} · {file.mime_type || "file"}</p><Button variant="accent" className="mt-4" onClick={onDownload}><Download className="h-4 w-4" /> Download</Button></div>}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, note }: { icon: React.ElementType; title: string; note: string }) {
  return <div className="flex flex-col items-center justify-center py-24 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full border border-border bg-card"><Icon className="h-6 w-6 text-muted-foreground" /></div><p className="text-sm font-medium">{title}</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">{note}</p></div>;
}
