"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Plus, FolderPlus, LayoutGrid, Table as TableIcon, LayoutList, Columns3, CalendarDays, ChevronLeft, ChevronRight, Star, Pencil, Archive, Trash2, FileText, Search, LayoutTemplate, LayoutDashboard, ChevronDown, Eye, RotateCcw } from "lucide-react";
import { getTemplateContent } from "@/lib/workspace/templates";

const WorkspaceReadOnlyPreview = dynamic(() => import("@/components/workspace/plate-editor").then((m) => m.WorkspaceReadOnlyPreview), {
  ssr: false,
  loading: () => <div className="p-6 text-center text-sm text-muted-foreground">Loading preview…</div>,
});
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/workspace/ui/dropdown-menu";
import { useDashboardActionToken } from "@/components/workspace/ui/action-token";
import { Button } from "@/components/workspace/ui/button";
import { Input } from "@/components/workspace/ui/input";
import { Label } from "@/components/workspace/ui/label";
import { Card, CardContent } from "@/components/workspace/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/workspace/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/workspace/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/workspace/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/workspace/ui/select";
import { cn } from "@/lib/utils";
import { ShareControl } from "@/components/workspace/share-control";
import type { WorkspaceDocListItem, WorkspaceFolder } from "@/lib/workspace/types";

type View = "list" | "cards" | "table" | "kanban" | "calendar";
type Tab = "mine" | "shared" | "favorites" | "templates" | "archived";
type ArchivedItem = WorkspaceDocListItem & { state: "archived" | "trashed" };

const VIEWS: { key: View; icon: typeof LayoutGrid }[] = [
  { key: "list", icon: LayoutList },
  { key: "cards", icon: LayoutGrid },
  { key: "table", icon: TableIcon },
  { key: "kanban", icon: Columns3 },
  { key: "calendar", icon: CalendarDays },
];

type TemplateItem = { id: string; name: string; description: string; category: string };
type SearchHit = { id: string; title: string; folder_name: string | null; snippet: string | null; updated_at: string };
type Space = { id: string; name: string; icon: string | null };

export function WorkspaceHome({ mine, shared, folders, templates, hiddenTemplateIds = [], favoriteTemplateIds = [], archived = [], workspaces = [], currentWorkspaceId }: { mine: WorkspaceDocListItem[]; shared: WorkspaceDocListItem[]; folders: WorkspaceFolder[]; templates: TemplateItem[]; hiddenTemplateIds?: string[]; favoriteTemplateIds?: string[]; archived?: ArchivedItem[]; workspaces?: Space[]; currentWorkspaceId?: string }) {
  const router = useRouter();
  const actionToken = useDashboardActionToken();
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const currentSpace = workspaces.find((w) => w.id === currentWorkspaceId);
  const hiddenSet = useMemo(() => new Set(hiddenTemplateIds), [hiddenTemplateIds]);
  const favTemplateSet = useMemo(() => new Set(favoriteTemplateIds), [favoriteTemplateIds]);
  // Favorites sort to the front; hidden ones drop out of the main grid.
  const visibleTemplates = useMemo(() => {
    const shown = templates.filter((t) => !hiddenSet.has(t.id)).map((t) => ({ ...t, is_favorite: favTemplateSet.has(t.id) }));
    return shown.sort((a, b) => (a.is_favorite === b.is_favorite ? 0 : a.is_favorite ? -1 : 1));
  }, [templates, hiddenSet, favTemplateSet]);
  const hiddenTemplates = useMemo(() => templates.filter((t) => hiddenSet.has(t.id)), [templates, hiddenSet]);
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setHits(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/workspace/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHits(res.ok ? data.results : []);
      } catch { setHits([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);
  const [view, setView] = useState<View>("cards");
  const [folderId, setFolderId] = useState<string>("all");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const favorites = useMemo(() => [...mine, ...shared].filter((d) => d.is_favorite), [mine, shared]);
  const source = tab === "mine" ? mine : tab === "shared" ? shared : favorites;
  const docs = folderId === "all" ? source : source.filter((d) => d.folder_id === folderId);

  async function post(url: string, body: Record<string, unknown>, method: "POST" | "PATCH" | "DELETE" = "POST") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionToken, ...body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function newDocument() {
    const scope = tab === "shared" ? "shared" : "personal";
    const data = await post("/api/workspace/documents", { scope, folderId: folderId === "all" ? null : folderId, workspaceId: currentWorkspaceId });
    if (data?.id) router.push(`/dashboard/workspace/${data.id}`);
  }
  async function newFromTemplate(templateId: string) {
    const data = await post("/api/workspace/documents", { scope: "personal", templateId, workspaceId: currentWorkspaceId });
    if (data?.id) router.push(`/dashboard/workspace/${data.id}`);
  }
  async function createWorkspace(name: string) {
    const data = await post("/api/workspace/spaces", { name });
    setNewSpaceOpen(false);
    if (data?.workspace?.id) router.push(`/dashboard/documents?ws=${data.workspace.id}`); else router.refresh();
  }
  async function deleteTemplate(id: string) { await post("/api/workspace/templates", { templateId: id }); router.refresh(); }
  async function restoreTemplate(id: string) { await post("/api/workspace/templates", { templateId: id }, "DELETE"); router.refresh(); }
  async function favoriteTemplate(id: string, on: boolean) { await post("/api/workspace/templates", { templateId: id, favorite: on }, "PATCH"); router.refresh(); }
  async function restoreDoc(id: string) { await post(`/api/workspace/documents/${id}`, { restore: true }, "PATCH"); router.refresh(); }
  async function purgeDoc(id: string) { await post(`/api/workspace/documents/${id}`, { purge: true }, "DELETE"); router.refresh(); }

  return (
    <div className="space-y-4">
      {workspaces.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-accent focus:outline-none">
              <LayoutDashboard className="h-4 w-4 text-accent" /> {currentSpace?.name ?? "Workspace"} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((w) => (
                <DropdownMenuItem key={w.id} onSelect={() => router.push(`/dashboard/documents?ws=${w.id}`)}>
                  <LayoutDashboard className={cn("h-4 w-4", w.id === currentWorkspaceId ? "text-accent" : "text-muted-foreground")} /> {w.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setNewSpaceOpen(true)}><Plus className="h-4 w-4" /> New workspace</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setNewSpaceOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New Workspace</Button>
        </div>
      ) : null}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" className="pl-8" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="mine">My Documents</TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
            <TabsTrigger value="templates"><LayoutTemplate className="mr-1.5 h-4 w-4" /> Templates</TabsTrigger>
            <TabsTrigger value="archived"><Archive className="mr-1.5 h-4 w-4" /> Archived{archived.length ? ` (${archived.length})` : ""}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {folders.length ? (
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All folders" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All folders</SelectItem>
                {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          <div className="inline-flex rounded-md border bg-card p-0.5">
            {VIEWS.map(({ key, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setView(key)} className={cn("rounded px-2.5 py-1.5 capitalize transition-colors", view === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")} aria-label={`${key} view`}><Icon className="h-4 w-4" /></button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}><FolderPlus className="mr-2 h-4 w-4" /> New Folder</Button>
          <Button size="sm" onClick={newDocument} disabled={busy}><Plus className="mr-2 h-4 w-4" /> New Document</Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {hits !== null ? (
        <SearchResults hits={hits} />
      ) : tab === "templates" ? (
        <TemplatesGallery templates={visibleTemplates} hidden={hiddenTemplates} onUse={newFromTemplate} onDelete={deleteTemplate} onRestore={restoreTemplate} onFavorite={favoriteTemplate} busy={busy} />
      ) : tab === "archived" ? (
        <ArchivedView archived={archived} onRestore={restoreDoc} onPurge={purgeDoc} busy={busy} />
      ) : (
      <Tabs value={tab}>
        <TabsContent value={tab} className="mt-0">
          {!docs.length ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">{tab === "favorites" ? "No favorites yet." : tab === "shared" ? "Nothing shared with you yet." : "No documents yet — create one to get started."}</CardContent></Card>
          ) : view === "cards" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {docs.map((d) => <DocCard key={d.id} doc={d} onAction={post} folders={folders} refresh={() => router.refresh()} />)}
            </div>
          ) : view === "list" ? (
            <Card><CardContent className="divide-y p-0">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Link href={`/dashboard/workspace/${d.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{d.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{d.folder_name ? `· ${d.folder_name}` : ""}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted-foreground sm:inline">{new Date(d.updated_at).toLocaleDateString()}</span>
                    <DocActions doc={d} onAction={post} refresh={() => router.refresh()} />
                  </div>
                </div>
              ))}
            </CardContent></Card>
          ) : view === "kanban" ? (
            <KanbanView docs={docs} onAction={post} refresh={() => router.refresh()} />
          ) : view === "calendar" ? (
            <CalendarView docs={docs} refresh={() => router.refresh()} />
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Folder</TableHead><TableHead>Owner</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {docs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium"><Link href={`/dashboard/workspace/${d.id}`} className="hover:underline">{d.title}</Link></TableCell>
                      <TableCell>{d.folder_name ?? "-"}</TableCell>
                      <TableCell>{d.owner_name ?? "-"}</TableCell>
                      <TableCell>{new Date(d.updated_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right"><DocActions doc={d} onAction={post} refresh={() => router.refresh()} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
      )}

      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} defaultScope={tab === "shared" ? "shared" : "personal"} onCreate={async (name, scope) => { await post("/api/workspace/folders", { name, scope, workspaceId: currentWorkspaceId }); setNewFolderOpen(false); router.refresh(); }} busy={busy} />
      <NewWorkspaceDialog open={newSpaceOpen} onOpenChange={setNewSpaceOpen} onCreate={createWorkspace} busy={busy} />
    </div>
  );
}

function SearchResults({ hits }: { hits: SearchHit[] }) {
  if (!hits.length) return <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No documents match your search.</CardContent></Card>;
  return (
    <Card><CardContent className="divide-y p-0">
      {hits.map((h) => (
        <Link key={h.id} href={`/dashboard/workspace/${h.id}`} className="block px-4 py-3 hover:bg-muted/50">
          <div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="font-medium">{h.title}</span>{h.folder_name ? <span className="text-xs text-muted-foreground">· {h.folder_name}</span> : null}</div>
          {h.snippet ? <p className="mt-0.5 truncate pl-6 text-xs text-muted-foreground">{h.snippet}</p> : null}
        </Link>
      ))}
    </CardContent></Card>
  );
}

function ArchivedView({ archived, onRestore, onPurge, busy }: { archived: ArchivedItem[]; onRestore: (id: string) => void; onPurge: (id: string) => void; busy: boolean }) {
  const [confirmPurge, setConfirmPurge] = useState<ArchivedItem | null>(null);
  if (!archived.length) return <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nothing archived or in the trash. Archived and deleted documents show up here so you can restore them.</CardContent></Card>;
  return (
    <>
      <Card><CardContent className="divide-y p-0">
        {archived.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{d.title}</span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", d.state === "trashed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{d.state === "trashed" ? "Trashed" : "Archived"}</span>
              </div>
              <p className="truncate pl-6 text-xs text-muted-foreground">{d.owner_name ?? ""}{d.folder_name ? ` · ${d.folder_name}` : ""} · {new Date(d.updated_at).toLocaleDateString()}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onRestore(d.id)} disabled={busy}><RotateCcw className="mr-1.5 h-4 w-4" /> Restore</Button>
              <button type="button" onClick={() => setConfirmPurge(d)} disabled={busy} title="Delete permanently" aria-label={`Delete ${d.title} permanently`} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </CardContent></Card>
      <Dialog open={!!confirmPurge} onOpenChange={(v) => { if (!v) setConfirmPurge(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete permanently?</DialogTitle><DialogDescription>“{confirmPurge?.title}” will be permanently removed. This can&apos;t be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPurge(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (confirmPurge) onPurge(confirmPurge.id); setConfirmPurge(null); }}>Delete permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplatesGallery({ templates, hidden, onUse, onDelete, onRestore, onFavorite, busy }: { templates: (TemplateItem & { is_favorite?: boolean })[]; hidden: TemplateItem[]; onUse: (id: string) => void; onDelete: (id: string) => void; onRestore: (id: string) => void; onFavorite: (id: string, on: boolean) => void; busy: boolean }) {
  const [showHidden, setShowHidden] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTemplate = templates.find((t) => t.id === previewId);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-accent" /><p className="font-medium">{t.name}</p></div>
                <button type="button" onClick={() => onFavorite(t.id, !t.is_favorite)} disabled={busy} title={t.is_favorite ? "Unfavorite" : "Favorite"} aria-label={t.is_favorite ? `Unfavorite ${t.name}` : `Favorite ${t.name}`} className={cn("shrink-0 rounded p-1 transition-colors hover:bg-accent disabled:opacity-50", t.is_favorite ? "text-amber-500" : "text-muted-foreground hover:text-foreground")}><Star className={cn("h-4 w-4", t.is_favorite && "fill-current")} /></button>
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.category}</p>
              <p className="flex-1 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-1 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onUse(t.id)} disabled={busy}><Plus className="mr-2 h-4 w-4" /> Use template</Button>
                <Button size="sm" variant="ghost" onClick={() => setPreviewId(t.id)}><Eye className="mr-1.5 h-4 w-4" /> View</Button>
                <button type="button" onClick={() => onDelete(t.id)} disabled={busy} title="Delete template" aria-label={`Delete ${t.name}`} className="ml-auto rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!previewId} onOpenChange={(v) => { if (!v) setPreviewId(null); }}>
        <DialogContent className="max-h-[85vh] gap-3 overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-accent" /> {previewTemplate?.name}</DialogTitle>
            <DialogDescription>{previewTemplate?.category} · {previewTemplate?.description} — preview only; nothing is created until you use it.</DialogDescription>
          </DialogHeader>
          {previewId ? <WorkspaceReadOnlyPreview value={getTemplateContent(previewId) ?? []} /> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewId(null)}>Close</Button>
            <Button onClick={() => { const id = previewId; setPreviewId(null); if (id) onUse(id); }} disabled={busy}><Plus className="mr-2 h-4 w-4" /> Use this template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {hidden.length ? (
        <div className="pt-1">
          <button type="button" onClick={() => setShowHidden((s) => !s)} className="text-xs text-muted-foreground hover:text-foreground">{showHidden ? "Hide" : "Show"} deleted templates ({hidden.length})</button>
          {showHidden ? (
            <div className="mt-2 divide-y rounded-md border">
              {hidden.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate text-muted-foreground">{t.name} <span className="text-xs">· {t.category}</span></span>
                  <button type="button" onClick={() => onRestore(t.id)} disabled={busy} className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-accent hover:underline disabled:opacity-50">Restore</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DocCard({ doc, onAction, refresh }: { doc: WorkspaceDocListItem; onAction: any; refresh: () => void; folders: WorkspaceFolder[] }) {
  return (
    <Card className="group relative transition-colors hover:border-accent/50">
      <CardContent className="p-4">
        <Link href={`/dashboard/workspace/${doc.id}`} className="block">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate font-medium">{doc.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{doc.folder_name ? `${doc.folder_name} · ` : ""}{doc.owner_name ?? ""} · {new Date(doc.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </Link>
        <div className="mt-3 flex items-center justify-end">
          <DocActions doc={doc} onAction={onAction} refresh={refresh} />
        </div>
      </CardContent>
    </Card>
  );
}

function DocActions({ doc, onAction, refresh }: { doc: WorkspaceDocListItem; onAction: any; refresh: () => void }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(doc.title);

  return (
    <div className="flex items-center gap-0.5">
      <button type="button" title="Favorite" onClick={async () => { await onAction(`/api/workspace/documents/${doc.id}/favorite`, { favorite: !doc.is_favorite }); refresh(); }} className={cn("rounded p-1.5 transition-colors hover:bg-accent", doc.is_favorite ? "text-amber-500" : "text-muted-foreground hover:text-foreground")}>
        <Star className={cn("h-4 w-4", doc.is_favorite && "fill-current")} />
      </button>
      <ShareControl documentId={doc.id} scope={doc.scope} onChanged={refresh} />
      <button type="button" title="Rename" onClick={() => setRenameOpen(true)} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" /></button>
      <button type="button" title="Archive" onClick={async () => { await onAction(`/api/workspace/documents/${doc.id}`, { status: "archived" }, "PATCH"); refresh(); }} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Archive className="h-4 w-4" /></button>
      <button type="button" title="Delete" onClick={() => setConfirmDelete(true)} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename document</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={async () => { await onAction(`/api/workspace/documents/${doc.id}`, { title }, "PATCH"); setRenameOpen(false); refresh(); }} disabled={!title.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete document?</DialogTitle><DialogDescription>“{doc.title}” will be removed. This can&apos;t be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => { await onAction(`/api/workspace/documents/${doc.id}`, {}, "DELETE"); setConfirmDelete(false); refresh(); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KanbanView({ docs, onAction, refresh }: { docs: WorkspaceDocListItem[]; onAction: any; refresh: () => void }) {
  const columns = useMemo(() => {
    const map = new Map<string, WorkspaceDocListItem[]>();
    for (const d of docs) {
      const key = d.folder_name ?? "Unfiled";
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return Array.from(map.entries());
  }, [docs]);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map(([label, items]) => (
        <div key={label} className="w-64 shrink-0">
          <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-sm font-medium"><span>{label}</span><span className="text-muted-foreground">{items.length}</span></div>
          <div className="space-y-2">
            {items.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-3">
                  <Link href={`/dashboard/workspace/${d.id}`} className="block truncate text-sm font-medium hover:underline">{d.title}</Link>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{new Date(d.updated_at).toLocaleDateString()}</span>
                    <DocActions doc={d} onAction={onAction} refresh={refresh} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarView({ docs, refresh }: { docs: WorkspaceDocListItem[]; refresh: () => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const byDay = useMemo(() => {
    const map = new Map<string, WorkspaceDocListItem[]>();
    for (const d of docs) {
      const dt = new Date(d.updated_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return map;
  }, [docs]);
  const first = new Date(cursor.y, cursor.m, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, k) => { const x = new Date(start); x.setDate(start.getDate() + k); return x; });
  const todayKey = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })();
  const shift = (delta: number) => setCursor((c) => { const m = c.m + delta; return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  return (
    <Card><CardContent className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{first.toLocaleDateString([], { month: "long", year: "numeric" })}</h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => shift(-1)} className="rounded border p-1 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => shift(1)} className="rounded border p-1 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const items = byDay.get(key) ?? [];
          const inMonth = d.getMonth() === cursor.m;
          return (
            <div key={key} className={cn("min-h-[76px] rounded border p-1", inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground/60", key === todayKey && "ring-1 ring-accent")}>
              <div className="text-xs">{d.getDate()}</div>
              <div className="mt-0.5 space-y-0.5">
                {items.slice(0, 3).map((doc) => (
                  <div key={doc.id} className="flex items-center gap-0.5 rounded bg-accent/15 pr-0.5 hover:bg-accent/25">
                    <Link href={`/dashboard/workspace/${doc.id}`} className="block min-w-0 flex-1 truncate px-1 py-0.5 text-[11px] text-accent" title={doc.title}>{doc.title}</Link>
                    <ShareControl documentId={doc.id} scope={doc.scope} onChanged={refresh} variant="mini" />
                  </div>
                ))}
                {items.length > 3 ? <div className="px-1 text-[10px] text-muted-foreground">+{items.length - 3}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

function NewWorkspaceDialog({ open, onOpenChange, onCreate, busy }: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (name: string) => void; busy: boolean }) {
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setName(""); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>New workspace</DialogTitle><DialogDescription>A workspace is a top-level space with its own folders and documents.</DialogDescription></DialogHeader>
        <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing, Board, Personal" autoFocus /></div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onCreate(name)} disabled={busy || !name.trim()}>Create workspace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewFolderDialog({ open, onOpenChange, defaultScope, onCreate, busy }: { open: boolean; onOpenChange: (v: boolean) => void; defaultScope: "personal" | "shared"; onCreate: (name: string, scope: "personal" | "shared") => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"personal" | "shared">(defaultScope);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" /></div>
          <div className="space-y-1.5"><Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "personal" | "shared")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="personal">Personal</SelectItem><SelectItem value="shared">Shared</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onCreate(name, scope)} disabled={busy || !name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
