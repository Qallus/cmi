"use client";

import * as React from "react";
import {
  Calendar, Camera, Check, ChevronLeft, ChevronRight, Cloud, CloudOff, Download, File as FileIcon,
  Folder, FolderPlus, HardDrive, Home, LayoutGrid, Link2, List as ListIcon, Loader2, MoreVertical,
  Pencil, RotateCcw, Search, Table2, Trash2, Upload, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FileRow, FolderRow } from "@/lib/files/types";
import { CloudPreview, fmtSize, previewKind } from "./cloud-preview";
import { ConfirmDialog, MoveDialog, PromptDialog } from "./cloud-dialogs";
import { CalendarView, DND_MIME, GridView, KindIcon, ListView, TableView, type DragPayload, type Layout, type ViewProps } from "./cloud-views";

export type ProjectOption = { id: string; title: string };
type ViewKey = "all" | "general" | "my" | "recent" | "trash" | `project:${string}`;
type Crumb = { id: string; name: string };
type SortKey = "name" | "modified" | "size" | "custom";
type UploadTask = { id: string; name: string; progress: number; status: "uploading" | "done" | "error" | "canceled"; error?: string; ctrl: AbortController };
type Dialog =
  | { kind: "new-folder" }
  | { kind: "rename"; target: "file" | "folder"; id: string; name: string }
  | { kind: "confirm-delete"; target: "file" | "folder"; id: string; name: string }
  | { kind: "move"; ids: DragPayload }
  | null;

const PAGE_SIZES = [24, 48, 96, 0] as const; // 0 = show all

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

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) { const next = queue.shift(); if (next !== undefined) await fn(next); }
  }));
}

export function CloudClient({ projects, meId, storageOnline }: { projects: ProjectOption[]; meId: string | null; storageOnline: boolean }) {
  const [view, setView] = React.useState<ViewKey>("all");
  const [path, setPath] = React.useState<Crumb[]>([]);
  const [layout, setLayout] = React.useState<Layout>("grid");
  const [sort, setSort] = React.useState<SortKey>("name");
  const [query, setQuery] = React.useState("");
  const [folders, setFolders] = React.useState<FolderRow[]>([]);
  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [storageUsed, setStorageUsed] = React.useState(0);
  const [online, setOnline] = React.useState(storageOnline);
  const [uploads, setUploads] = React.useState<UploadTask[]>([]);
  const [preview, setPreview] = React.useState<FileRow | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [projectsOpen, setProjectsOpen] = React.useState(true);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(48);
  const [toast, setToast] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const folderId = path.length ? path[path.length - 1].id : null;
  const isBrowse = !["my", "recent", "trash"].includes(view);
  const isTrash = view === "trash";
  const scopeProject: string | null = view.startsWith("project:") ? view.slice(8) : null;
  const canModify = React.useCallback((row: { uploaded_by?: string | null; created_by?: string | null }) => (row.uploaded_by ?? row.created_by) === meId, [meId]);

  React.useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (view === "my") params.set("view", "my");
    else if (view === "recent") params.set("view", "recent");
    else if (view === "trash") params.set("view", "trash");
    else if (view === "general") { params.set("project", "general"); if (folderId) params.set("folder", folderId); }
    else if (view.startsWith("project:")) { params.set("project", view.slice(8)); if (folderId) params.set("folder", folderId); }
    else if (folderId) params.set("folder", folderId);
    const res = await fetch(`/api/files?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      setFolders(j.folders ?? []); setFiles(j.files ?? []); setStorageUsed(j.storageUsed ?? 0); setOnline(j.storageOnline ?? true);
    }
    setLoading(false);
  }, [view, folderId]);
  React.useEffect(() => { const id = setTimeout(() => void load(), 0); return () => clearTimeout(id); }, [load]);

  // Clearing selection/page happens wherever the listing changes, rather than
  // in an effect that would re-render twice.
  const resetListState = () => { setSelected(new Set()); setPage(0); };
  function switchView(v: ViewKey) { setView(v); setPath([]); setQuery(""); resetListState(); }
  function goToPath(next: Crumb[]) { setPath(next); resetListState(); }

  // ── Sorting + pagination ──
  const sorted = React.useMemo(() => {
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    const cmp = (a: FileRow, b: FileRow) =>
      sort === "custom" ? (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) || byName(a, b)
      : sort === "name" ? byName(a, b)
      : sort === "modified" ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      : (b.size_bytes ?? 0) - (a.size_bytes ?? 0);
    const f = [...folders].sort((a, b) => sort === "custom" ? (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) || byName(a, b) : byName(a, b));
    return { folders: f, files: [...files].sort(cmp) };
  }, [folders, files, sort]);

  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(sorted.files.length / pageSize));
  // Clamp rather than resetting state: the list can shrink under us.
  const safePage = Math.min(page, pageCount - 1);
  const pageFiles = pageSize === 0 ? sorted.files : sorted.files.slice(safePage * pageSize, safePage * pageSize + pageSize);

  // ── Uploads ──
  async function uploadFiles(list: FileList | File[]) {
    for (const file of Array.from(list)) {
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

  // ── Item actions ──
  const patch = (kind: "file" | "folder", id: string, body: Record<string, unknown>) =>
    fetch(`/api/files/${kind === "folder" ? "folders/" : ""}${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function createFolder(name: string) {
    await fetch("/api/files/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, project_id: scopeProject, parent_id: isBrowse ? folderId : null }) });
    setDialog(null); void load();
  }
  async function rename(kind: "file" | "folder", id: string, name: string) { await patch(kind, id, { name }); setDialog(null); void load(); }
  async function trashItem(kind: "file" | "folder", id: string) { await patch(kind, id, { trash: true }); void load(); }
  async function restoreItem(kind: "file" | "folder", id: string) { await patch(kind, id, { restore: true }); void load(); }
  async function deleteForever(kind: "file" | "folder", id: string) {
    await fetch(`/api/files/${kind === "folder" ? "folders/" : ""}${id}`, { method: "DELETE" });
    setDialog(null); void load();
  }
  async function downloadFile(f: FileRow) {
    const r = await fetch(`/api/files/${f.id}/url?download=1`);
    if (r.ok) { const { url } = await r.json(); window.open(url, "_blank", "noopener"); }
  }
  async function copyLink(f: FileRow) {
    const r = await fetch(`/api/files/${f.id}/url`);
    if (r.ok) {
      const { url } = await r.json();
      try { await navigator.clipboard.writeText(new URL(url, window.location.origin).href); setToast("Link copied."); } catch { setToast("Couldn't copy the link."); }
    }
  }

  // ── Selection + bulk ──
  const selectedItems = (): DragPayload => [
    ...sorted.folders.filter((f) => selected.has(f.id)).map((f) => ({ id: f.id, kind: "folder" as const })),
    ...sorted.files.filter((f) => selected.has(f.id)).map((f) => ({ id: f.id, kind: "file" as const })),
  ];
  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  async function bulkTrash() {
    const items = selectedItems();
    await Promise.all(items.map((i) => patch(i.kind, i.id, { trash: true })));
    setSelected(new Set()); setToast(`Moved ${items.length} item${items.length === 1 ? "" : "s"} to Trash.`); void load();
  }
  async function bulkDownload() {
    const files = sorted.files.filter((f) => selected.has(f.id));
    for (const f of files) { await downloadFile(f); await new Promise((r) => setTimeout(r, 400)); }
  }
  async function moveItems(items: DragPayload, targetFolderId: string | null) {
    await Promise.all(items.map((i) => patch(i.kind, i.id, i.kind === "folder" ? { parent_id: targetFolderId } : { folder_id: targetFolderId })));
    setSelected(new Set()); setDialog(null);
    setToast(`Moved ${items.length} item${items.length === 1 ? "" : "s"}.`);
    void load();
  }

  // ── Drag & drop ──
  const dragItemsRef = React.useRef<DragPayload>([]);
  function onDragStartItem(e: React.DragEvent, item: { id: string; kind: "file" | "folder" }) {
    // Dragging a selected item drags the whole selection.
    const items = selected.has(item.id) ? selectedItems() : [item];
    dragItemsRef.current = items;
    e.dataTransfer.setData(DND_MIME, JSON.stringify(items));
    e.dataTransfer.effectAllowed = "move";
  }
  const readDrag = (e: React.DragEvent): DragPayload => {
    try { const raw = e.dataTransfer.getData(DND_MIME); if (raw) return JSON.parse(raw); } catch { /* fall through */ }
    return dragItemsRef.current;
  };
  async function onDropOnFolder(e: React.DragEvent, targetFolderId: string) {
    const items = readDrag(e).filter((i) => !(i.kind === "folder" && i.id === targetFolderId));
    if (items.length) await moveItems(items, targetFolderId);
  }
  async function onDropBefore(e: React.DragEvent, index: number) {
    const items = readDrag(e).filter((i) => i.kind === "file");
    if (!items.length) return;
    const moving = new Set(items.map((i) => i.id));
    const rest = pageFiles.filter((f) => !moving.has(f.id));
    const movingRows = pageFiles.filter((f) => moving.has(f.id));
    const at = Math.min(index, rest.length);
    const next = [...rest.slice(0, at), ...movingRows, ...rest.slice(at)];
    // Optimistic: apply locally, then persist positions.
    const orders = next.map((f, i) => ({ id: f.id, kind: "file" as const, sort_order: (safePage * (pageSize || next.length) + i) * 10 }));
    setFiles((prev) => prev.map((f) => { const o = orders.find((x) => x.id === f.id); return o ? { ...f, sort_order: o.sort_order } : f; }));
    setSort("custom");
    await fetch("/api/files/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: orders }) });
    void load();
  }
  function onDropExternal(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    if (!online) return;
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  const activeUploads = uploads.filter((u) => u.status === "uploading").length;

  const itemMenu = (kind: "file" | "folder", row: FileRow | FolderRow) => (
    <ItemMenu
      open={menuFor === row.id} onToggle={() => setMenuFor(menuFor === row.id ? null : row.id)}
      trash={isTrash} canModify={canModify(row)}
      onPreview={kind === "file" ? () => setPreview(row as FileRow) : undefined}
      onDownload={kind === "file" ? () => downloadFile(row as FileRow) : undefined}
      onCopyLink={kind === "file" ? () => copyLink(row as FileRow) : undefined}
      onRename={() => setDialog({ kind: "rename", target: kind, id: row.id, name: row.name })}
      onTrash={() => trashItem(kind, row.id)}
      onRestore={() => restoreItem(kind, row.id)}
      onDelete={() => setDialog({ kind: "confirm-delete", target: kind, id: row.id, name: row.name })}
    />
  );

  const viewProps: ViewProps = {
    folders: sorted.folders,
    files: pageFiles,
    selected,
    onSelect: toggleSelect,
    onOpenFolder: (f) => { if (!isTrash) goToPath([...path, { id: f.id, name: f.name }]); },
    onPreview: (f) => { if (!isTrash) setPreview(f); },
    menu: itemMenu,
    dnd: { enabled: online && !isTrash, reorderable: isBrowse && !isTrash, onDragStart: onDragStartItem, onDropOnFolder, onDropBefore },
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col lg:flex-row"
      onDragOver={(e) => { if (online && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)} onDrop={onDropExternal}>
      {/* Left panel */}
      <aside className="flex shrink-0 flex-col border-b border-border bg-card lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-3.5"><Cloud className="h-5 w-5 text-accent" /><span className="font-display text-lg font-semibold">Cloud</span></div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          <NavBtn active={view === "my"} icon={FileIcon} label="My Uploads" onClick={() => switchView("my")} />
          <NavBtn active={view === "all"} icon={HardDrive} label="All Files" onClick={() => switchView("all")} />
          <NavBtn active={view === "general"} icon={Folder} label="General" onClick={() => switchView("general")} />
          <NavBtn active={view === "recent"} icon={RotateCcw} label="Recent" onClick={() => switchView("recent")} />
          <NavBtn active={view === "trash"} icon={Trash2} label="Trash" onClick={() => switchView("trash")} />
        </nav>
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
            <BreadcrumbDrop onDrop={(e) => { const items = readDrag(e); if (items.length) void moveItems(items, null); }} active={online && !isTrash}>
              <button onClick={() => goToPath([])} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Home className="h-3.5 w-3.5" /></button>
            </BreadcrumbDrop>
            {path.map((c, i) => (
              <span key={c.id} className="inline-flex min-w-0 items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <BreadcrumbDrop onDrop={(e) => { const items = readDrag(e); if (items.length) void moveItems(items, c.id); }} active={online && !isTrash}>
                  <button onClick={() => goToPath(path.slice(0, i + 1))} className="truncate rounded px-1 py-0.5 hover:bg-muted">{c.name}</button>
                </BreadcrumbDrop>
              </span>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) { setView("all"); void searchNow(query, setFolders, setFiles, setLoading); } }}
              placeholder="Search files…" className="w-40 pl-8 sm:w-56" />
          </div>
          <div className="flex overflow-hidden rounded-md border border-border">
            {([["grid", LayoutGrid], ["list", ListIcon], ["table", Table2], ["calendar", Calendar]] as const).map(([key, Icon]) => (
              <button key={key} title={key[0].toUpperCase() + key.slice(1)} aria-label={key} onClick={() => setLayout(key)}
                className={cn("grid h-8 w-8 place-items-center", layout === key ? "bg-accent text-accent-foreground" : "hover:bg-muted")}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort" className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            <option value="name">Name</option><option value="modified">Modified</option><option value="size">Size</option><option value="custom">Custom order</option>
          </select>
          {isBrowse && online && (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "new-folder" })}><FolderPlus className="h-4 w-4" /> <span className="hidden sm:inline">New folder</span></Button>
              <Button size="sm" variant="accent" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Upload</Button>
              <Button size="sm" variant="outline" className="lg:hidden" onClick={() => cameraInputRef.current?.click()}><Camera className="h-4 w-4" /></Button>
            </>
          )}
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.currentTarget.value = ""; }} />
          <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.currentTarget.value = ""; }} />
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/10 px-4 py-2 text-sm md:px-6">
            <span className="font-medium">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => void bulkDownload()}><Download className="h-3.5 w-3.5" /> Download</Button>
            {isBrowse && <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "move", ids: selectedItems() })}><Folder className="h-3.5 w-3.5" /> Move to…</Button>}
            {!isTrash && <Button size="sm" variant="outline" className="text-destructive" onClick={() => void bulkTrash()}><Trash2 className="h-3.5 w-3.5" /> Trash</Button>}
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {!online ? (
            <EmptyState icon={CloudOff} title="Files are temporarily unavailable" note="The office storage server is unreachable. The rest of the dashboard still works — try again shortly." />
          ) : loading ? (
            <div className={cn(layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" : "space-y-1")}>
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className={cn("animate-pulse rounded-lg bg-muted", layout === "grid" ? "aspect-square" : "h-12")} />)}
            </div>
          ) : sorted.folders.length === 0 && sorted.files.length === 0 ? (
            <EmptyState icon={isTrash ? Trash2 : Cloud} title={isTrash ? "Trash is empty" : "No files yet"}
              note={isTrash ? "Deleted files and folders appear here." : isBrowse ? "Drag files here, or use the Upload button to get started." : "Nothing to show."} />
          ) : layout === "calendar" ? (
            <CalendarView files={sorted.files} onPreview={viewProps.onPreview} menu={itemMenu} />
          ) : layout === "table" ? (
            <TableView {...viewProps} />
          ) : layout === "list" ? (
            <ListView {...viewProps} />
          ) : (
            <GridView {...viewProps} />
          )}

          {/* Pagination */}
          {layout !== "calendar" && sorted.files.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {pageSize === 0
                  ? `${sorted.files.length} file${sorted.files.length === 1 ? "" : "s"}`
                  : `Showing ${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, sorted.files.length)} of ${sorted.files.length}`}
                {sorted.folders.length > 0 && ` · ${sorted.folders.length} folder${sorted.folders.length === 1 ? "" : "s"}`}
              </span>
              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} aria-label="Files per page"
                  className="h-7 rounded-md border border-border bg-background px-1.5 text-xs">
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n === 0 ? "All" : `${n} / page`}</option>)}
                </select>
                {pageCount > 1 && (
                  <div className="flex items-center gap-1">
                    <button aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="grid h-7 w-7 place-items-center rounded border border-border disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <span>{safePage + 1} / {pageCount}</span>
                    <button aria-label="Next page" disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)} className="grid h-7 w-7 place-items-center rounded border border-border disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
          <div className="max-h-56 overflow-y-auto">
            {uploads.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {t.status === "uploading" ? (
                  <>
                    <div className="h-1 w-16 overflow-hidden rounded bg-muted"><div className="h-full bg-accent transition-all" style={{ width: `${t.progress}%` }} /></div>
                    <button onClick={() => { t.ctrl.abort(); setUploads((u) => u.map((x) => x.id === t.id ? { ...x, status: "canceled" } : x)); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </>
                ) : t.status === "done" ? <Check className="h-4 w-4 text-success" />
                  : <span className="text-destructive">{t.status === "canceled" ? "Canceled" : t.error ?? "Failed"}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview + dialogs */}
      {preview && <CloudPreview file={preview} onDownload={() => void downloadFile(preview)} onClose={() => setPreview(null)} />}
      {dialog?.kind === "new-folder" && (
        <PromptDialog title="New folder" icon={FolderPlus} label="Folder name" placeholder="e.g. Permits" submitLabel="Create folder"
          onSubmit={(v) => createFolder(v)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "rename" && (
        <PromptDialog title={`Rename ${dialog.target}`} icon={Pencil} label="Name" initial={dialog.name} submitLabel="Rename"
          onSubmit={(v) => rename(dialog.target, dialog.id, v)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "confirm-delete" && (
        <ConfirmDialog title={`Delete ${dialog.target} forever`} confirmLabel="Delete forever"
          message={<>“{dialog.name}” {dialog.target === "folder" ? "and everything inside it " : ""}will be permanently removed from storage. This can&apos;t be undone.</>}
          onConfirm={() => deleteForever(dialog.target, dialog.id)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "move" && (
        <MoveDialog folders={sorted.folders} currentFolderId={folderId} count={dialog.ids.length}
          onMove={(target) => moveItems(dialog.ids, target)} onClose={() => setDialog(null)} />
      )}
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>
  );
}

async function searchNow(term: string, setFolders: (f: FolderRow[]) => void, setFiles: (f: FileRow[]) => void, setLoading: (b: boolean) => void) {
  setLoading(true);
  const r = await fetch(`/api/files?q=${encodeURIComponent(term)}`);
  if (r.ok) { const j = await r.json(); setFolders(j.folders ?? []); setFiles(j.files ?? []); }
  setLoading(false);
}

// Breadcrumb entries accept drops, so you can drag items up a level.
function BreadcrumbDrop({ children, onDrop, active }: { children: React.ReactNode; onDrop: (e: React.DragEvent) => void; active: boolean }) {
  const [over, setOver] = React.useState(false);
  return (
    <span
      onDragOver={(e) => { if (!active || e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); if (!active) return; e.preventDefault(); onDrop(e); }}
      className={cn("rounded", over && "bg-accent/20 ring-1 ring-accent")}
    >
      {children}
    </span>
  );
}

function NavBtn({ active, icon: Icon, label, onClick, small }: { active: boolean; icon: React.ElementType; label: string; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition",
      small && "py-1.5 text-xs", active ? "bg-accent/15 font-medium text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <Icon className={cn("shrink-0", small ? "h-3.5 w-3.5" : "h-4 w-4")} /> <span className="truncate">{label}</span>
    </button>
  );
}

function ItemMenu({ open, onToggle, trash, canModify, onPreview, onDownload, onCopyLink, onRename, onTrash, onRestore, onDelete }: {
  open: boolean; onToggle: () => void; trash: boolean; canModify: boolean;
  onPreview?: () => void; onDownload?: () => void; onCopyLink?: () => void; onRename?: () => void; onTrash?: () => void; onRestore?: () => void; onDelete?: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onToggle(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onToggle]);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="Actions"
        className="grid h-7 w-7 place-items-center rounded-md bg-card/80 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[open=true]:opacity-100" data-open={open}>
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
          {trash ? (
            <>
              <MenuItem icon={RotateCcw} label="Restore" onClick={() => { onToggle(); onRestore?.(); }} disabled={!canModify} />
              <MenuItem icon={Trash2} label="Delete forever" danger onClick={() => { onToggle(); onDelete?.(); }} disabled={!canModify} />
            </>
          ) : (
            <>
              {onPreview && <MenuItem icon={FileIcon} label="Preview" onClick={() => { onToggle(); onPreview(); }} />}
              {onDownload && <MenuItem icon={Download} label="Download" onClick={() => { onToggle(); onDownload(); }} />}
              {onCopyLink && <MenuItem icon={Link2} label="Copy link" onClick={() => { onToggle(); onCopyLink(); }} />}
              <MenuItem icon={Pencil} label="Rename" onClick={() => { onToggle(); onRename?.(); }} disabled={!canModify} />
              <MenuItem icon={Trash2} label="Move to Trash" danger onClick={() => { onToggle(); onTrash?.(); }} disabled={!canModify} />
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

function EmptyState({ icon: Icon, title, note }: { icon: React.ElementType; title: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full border border-border bg-card"><Icon className="h-6 w-6 text-muted-foreground" /></div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

// Re-exported so other dashboard code can reuse the file-type icon.
export { KindIcon, previewKind, Loader2 };
