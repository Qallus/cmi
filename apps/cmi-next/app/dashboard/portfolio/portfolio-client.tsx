"use client";

import * as React from "react";
import { Archive, ArchiveRestore, AlertTriangle, CheckCircle2, Columns2, Eye, ExternalLink, GripVertical, Image, LayoutGrid, List, Loader2, Pencil, Plus, RotateCcw, Share2, Table2, Trash2, Upload, Video, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ViewMode = "cards" | "list" | "table" | "kanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/portfolio/data";
import type { PortfolioAttribute, PortfolioInput, PortfolioItem, PortfolioStatus } from "@/lib/portfolio/types";

type Draft = PortfolioInput & { id?: string };

const emptyDraft: Draft = {
  title: "",
  slug: "",
  subtitle: "",
  category: "Residential",
  year: new Date().getFullYear(),
  location: "",
  timeline: "",
  square_feet: null,
  description: "",
  featured_image: "",
  gallery_images: [],
  video_urls: [],
  services_used: [],
  attributes_json: [],
  tags: [],
  status: "draft",
  is_featured: false,
  client_visible: true,
  sort_order: 0,
  seo_title: "",
  seo_description: ""
};

const categories = ["Residential", "Commercial", "ADU", "Interior Design", "New Construction", "Renovation / Remodel", "Outdoor Living"];
const serviceOptions = ["Site Preparation & Grading", "Permitting & Entitlements", "Foundation & Concrete", "Framing", "Electrical", "Plumbing", "HVAC / Mechanical", "Insulation & Drywall", "Flooring", "Tile & Stone", "Cabinetry & Millwork", "Painting & Coatings", "Landscaping", "Interior Design", "Lighting Design"];

function itemToDraft(item: PortfolioItem): Draft {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug || "",
    subtitle: item.subtitle || "",
    category: item.category || "Residential",
    year: item.year,
    location: item.location || "",
    timeline: item.timeline || "",
    square_feet: item.square_feet,
    description: item.description || "",
    featured_image: item.featured_image || "",
    gallery_images: item.gallery_images || [],
    video_urls: item.video_urls || [],
    services_used: item.services_used || [],
    attributes_json: item.attributes_json || [],
    tags: item.tags || [],
    status: item.status,
    is_featured: item.is_featured,
    client_visible: item.client_visible,
    sort_order: item.sort_order || 0,
    seo_title: item.seo_title || "",
    seo_description: item.seo_description || ""
  };
}

function draftToItem(draft: Draft): PortfolioItem {
  const now = new Date().toISOString();
  return {
    id: draft.id || `local-${crypto.randomUUID()}`,
    project_id: null,
    wp_post_id: null,
    title: draft.title,
    slug: draft.slug || slugify(draft.title),
    subtitle: draft.subtitle || null,
    category: draft.category || null,
    year: draft.year || null,
    location: draft.location || null,
    timeline: draft.timeline || null,
    square_feet: draft.square_feet || null,
    description: draft.description || null,
    featured_image: draft.featured_image || null,
    gallery_images: draft.gallery_images || [],
    video_urls: draft.video_urls || [],
    services_used: draft.services_used || [],
    attributes_json: draft.attributes_json || [],
    tags: draft.tags || [],
    status: draft.status || "draft",
    is_featured: Boolean(draft.is_featured),
    client_visible: draft.client_visible !== false,
    sort_order: draft.sort_order || 0,
    seo_title: draft.seo_title || null,
    seo_description: draft.seo_description || null,
    published_at: draft.status === "published" ? now : null,
    last_synced_at: null,
    sync_status: "local",
    sync_error: null,
    metadata: {},
    created_at: now,
    updated_at: now
  };
}

export function PortfolioClient({ initialItems, demoMode }: { initialItems: PortfolioItem[]; demoMode: boolean }) {
  const [items, setItems] = React.useState(initialItems);
  const [activeCategory, setActiveCategory] = React.useState("All");
  const [view, setView] = React.useState<ViewMode>("cards");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(demoMode ? "Demo mode: portfolio changes are local until Supabase is configured." : null);

  // Drag state
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);

  // Trash + confirm state
  const [trashMode, setTrashMode] = React.useState(false);
  const [trashItems, setTrashItems] = React.useState<PortfolioItem[]>([]);
  const [trashLoading, setTrashLoading] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<PortfolioItem | null>(null);
  const [confirmPurge, setConfirmPurge] = React.useState<PortfolioItem | null>(null);
  const [preview, setPreview] = React.useState<PortfolioItem | null>(null);

  async function openTrash() {
    setTrashMode(true);
    if (demoMode) return;
    setTrashLoading(true);
    try {
      const res = await fetch("/api/admin/portfolio?trashed=true");
      const json = await res.json();
      if (res.ok) setTrashItems(json.items || []);
    } finally { setTrashLoading(false); }
  }

  async function doDelete(item: PortfolioItem) {
    setConfirmDelete(null);
    if (demoMode) { setItems(current => current.filter(row => row.id !== item.id)); return; }
    const res = await fetch(`/api/admin/portfolio/${item.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setNotice(json.message || "Move to Trash failed."); return; }
    setItems(current => current.filter(row => row.id !== item.id));
    setNotice(`“${item.title}” moved to Trash.`);
  }

  async function restore(item: PortfolioItem) {
    const res = await fetch(`/api/admin/portfolio/${item.id}?restore=true`, { method: "PATCH" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setNotice(json.message || "Restore failed."); return; }
    setTrashItems(current => current.filter(row => row.id !== item.id));
    setNotice(`“${item.title}” restored.`);
    void refresh();
  }

  async function deleteForever(item: PortfolioItem) {
    setConfirmPurge(null);
    const res = await fetch(`/api/admin/portfolio/${item.id}?permanent=true`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setNotice(json.message || "Delete failed."); return; }
    setTrashItems(current => current.filter(row => row.id !== item.id));
    setNotice(`“${item.title}” permanently deleted.`);
  }

  async function toggleArchive(item: PortfolioItem) {
    await quickStatus(item, item.status === "archived" ? "published" : "archived");
  }

  const filtered = activeCategory === "All" ? items : items.filter(item => item.category === activeCategory);
  const categoryList = ["All", ...Array.from(new Set([...categories, ...items.map(item => item.category || "").filter(Boolean)]))];

  async function refresh() {
    if (demoMode) return;
    const res = await fetch("/api/admin/portfolio");
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Portfolio refresh failed.");
    setItems(json.items || []);
  }

  async function savePortfolio(nextDraft: Draft) {
    setSaving(true);
    setNotice(null);
    const payload = {
      ...nextDraft,
      slug: nextDraft.slug || slugify(nextDraft.title),
      gallery_images: nextDraft.gallery_images || [],
      video_urls: nextDraft.video_urls || [],
      services_used: nextDraft.services_used || [],
      tags: nextDraft.tags || [],
      attributes_json: nextDraft.attributes_json || []
    };

    if (demoMode) {
      const nextItem = draftToItem(payload);
      setItems(current => nextDraft.id ? current.map(item => item.id === nextDraft.id ? nextItem : item) : [nextItem, ...current]);
      setDraft(null);
      setSaving(false);
      setNotice("Portfolio item saved locally in demo mode.");
      return;
    }

    try {
      const res = await fetch(nextDraft.id ? `/api/admin/portfolio/${nextDraft.id}` : "/api/admin/portfolio", {
        method: nextDraft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Portfolio save failed.");
      setDraft(null);
      setNotice(`${json.item.title} saved.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Portfolio save failed.");
    } finally {
      setSaving(false);
    }
  }

  function deletePortfolio(item: PortfolioItem) {
    // Opens a styled confirm; the actual soft-delete happens in doDelete().
    setConfirmDelete(item);
  }

  async function quickStatus(item: PortfolioItem, status: PortfolioStatus) {
    await savePortfolio({ ...itemToDraft(item), status });
  }

  async function share(item: PortfolioItem) {
    const url = `${window.location.origin}/portfolio/${item.slug || item.id}`;
    await navigator.clipboard?.writeText(url);
    setNotice(`Copied portfolio link: ${url}`);
  }

  // Opens the live public portfolio page in a new tab (published items render;
  // drafts/archived won't be live — use Quick View for those).
  function viewFrontend(item: PortfolioItem) {
    window.open(`/portfolio/${item.slug || item.id}`, "_blank", "noopener");
  }

  // ── Drag and drop ──────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id); e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault(); if (id !== dragOverId) setDragOverId(id);
  }
  function onDragOverCol(e: React.DragEvent, col: string) {
    e.preventDefault(); if (col !== dragOverCol) setDragOverCol(col); setDragOverId(null);
  }
  function onDragEnd() { setDraggingId(null); setDragOverId(null); setDragOverCol(null); }

  function onDrop(e: React.DragEvent, targetId: string, newCategory?: string) {
    e.preventDefault();
    const fromId = draggingId; onDragEnd();
    if (!fromId || fromId === targetId) return;
    reorder(fromId, targetId, newCategory);
  }
  function onDropCol(e: React.DragEvent, toCategory: string) {
    e.preventDefault();
    const fromId = draggingId; onDragEnd();
    if (!fromId) return;
    const from = items.find((i) => i.id === fromId);
    if (!from || from.category === toCategory) return;
    const without = items.filter((i) => i.id !== fromId);
    const lastInCol = [...without].reverse().find((i) => i.category === toCategory);
    const insertAt = lastInCol ? without.findIndex((i) => i.id === lastInCol.id) + 1 : without.length;
    without.splice(insertAt, 0, { ...from, category: toCategory });
    persistReorder(without, fromId, toCategory);
  }

  function reorder(fromId: string, toId: string, newCategory?: string) {
    const fromIdx = items.findIndex((i) => i.id === fromId);
    const toIdx = items.findIndex((i) => i.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...items];
    const [dragged] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, newCategory !== undefined ? { ...dragged, category: newCategory } : dragged);
    persistReorder(next, fromId, newCategory);
  }

  function persistReorder(ordered: PortfolioItem[], changedCatId?: string, newCat?: string) {
    const withOrder = ordered.map((item, i) => ({ ...item, sort_order: i + 1 }));
    setItems(withOrder);
    if (demoMode) return;
    void Promise.all(
      withOrder
        .filter((item) => {
          const orig = items.find((o) => o.id === item.id);
          return orig && (orig.sort_order !== item.sort_order || (item.id === changedCatId && newCat !== undefined));
        })
        .map((item) => {
          const body: Record<string, unknown> = { sort_order: item.sort_order };
          if (item.id === changedCatId && newCat !== undefined) body.category = newCat;
          return fetch(`/api/admin/portfolio/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        })
    );
  }

  const kanbanCols = React.useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category || "Uncategorized")));
    return cats.map((cat) => ({ cat, items: filtered.filter((i) => (i.category || "Uncategorized") === cat) }));
  }, [items, filtered]);

  const dragProps = (item: PortfolioItem, cat?: string) => ({
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => onDragStart(e, item.id),
    onDragOver: (e: React.DragEvent) => onDragOver(e, item.id),
    onDrop: (e: React.DragEvent) => onDrop(e, item.id, cat),
    onDragEnd,
  });

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Work</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Manage dashboard-driven project stories, media, categories, and public visibility from one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-card p-0.5">
            {([["cards", LayoutGrid], ["list", List], ["table", Table2], ["kanban", Columns2]] as [ViewMode, React.ElementType][]).map(([v, Icon]) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={cn("flex h-7 w-7 items-center justify-center rounded transition", view === v ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}
                title={v.charAt(0).toUpperCase() + v.slice(1)}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => void openTrash()} title="View trashed items">
            <Trash2 className="h-4 w-4" />
            Trash
          </Button>
          <Button onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="h-4 w-4" />
            Add Portfolio
          </Button>
        </div>
      </header>

      {notice ? <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

      <div className="flex flex-wrap gap-2">
        {categoryList.map(category => (
          <button
            key={category}
            type="button"
            className={cn("rounded-full border px-3 py-1 text-xs transition hover:border-accent hover:text-accent", activeCategory === category ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground")}
            onClick={() => setActiveCategory(category)}
          >
            {category} ({category === "All" ? items.length : items.filter(item => item.category === category).length})
          </button>
        ))}
      </div>

      {/* ── Cards view ── */}
      {view === "cards" && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filtered.map(item => (
            <Card key={item.id} {...dragProps(item)}
              className={cn("overflow-hidden cursor-grab active:cursor-grabbing transition",
                draggingId === item.id ? "opacity-40 scale-95" : "",
                dragOverId === item.id ? "ring-2 ring-accent" : "")}>
              <div className="relative aspect-[4/3] bg-muted">
                {item.featured_image ? <img src={item.featured_image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Image className="h-8 w-8" /></div>}
                <button type="button" title="Quick View" onClick={() => setPreview(item)} onMouseDown={(e) => e.stopPropagation()} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white shadow-md backdrop-blur transition hover:bg-black/75">
                  <Eye className="h-3.5 w-3.5" /> Quick View
                </button>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{item.title}</h2>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.category || "Uncategorized"} · {item.year || "No year"}</p>
                  </div>
                  <Badge tone={item.status === "published" ? "success" : item.status === "archived" || item.status === "hidden" ? "warning" : "default"}>{item.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.is_featured ? <Badge tone="accent">Featured</Badge> : null}
                  {(item.gallery_images || []).length ? <Badge>{item.gallery_images?.length} images</Badge> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPreview(item)}><Eye className="h-3.5 w-3.5" /> Quick View</Button>
                  <Button size="sm" variant="outline" onClick={() => viewFrontend(item)}><ExternalLink className="h-3.5 w-3.5" /> View</Button>
                  <Button size="sm" variant="outline" onClick={() => void share(item)}><Share2 className="h-3.5 w-3.5" /> Share</Button>
                  <Button size="sm" variant="outline" onClick={() => setDraft(itemToDraft(item))}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => void toggleArchive(item)}>{item.status === "archived" ? <><ArchiveRestore className="h-3.5 w-3.5" /> Unarchive</> : <><Archive className="h-3.5 w-3.5" /> Archive</>}</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void deletePortfolio(item)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* ── List view ── */}
      {view === "list" && (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} {...dragProps(item)}
              className={cn("flex items-center gap-4 rounded-xl border bg-card p-4 cursor-grab active:cursor-grabbing transition",
                draggingId === item.id ? "opacity-40" : "",
                dragOverId === item.id ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40")}>
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.featured_image ? <img src={item.featured_image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Image className="h-5 w-5 text-muted-foreground/40" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{item.title}</span>
                  <Badge tone={item.status === "published" ? "success" : item.status === "archived" || item.status === "hidden" ? "warning" : "default"}>{item.status}</Badge>
                  {item.is_featured && <Badge tone="accent">Featured</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.category || "Uncategorized"} · {item.location || "Arizona"} · {item.year || "—"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="outline" title="Quick View" onClick={() => setPreview(item)}><Eye className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" title="View live page" onClick={() => viewFrontend(item)}><ExternalLink className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" title="Share" onClick={() => void share(item)}><Share2 className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" title="Edit" onClick={() => setDraft(itemToDraft(item))}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" title={item.status === "archived" ? "Unarchive" : "Archive"} onClick={() => void toggleArchive(item)}>{item.status === "archived" ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" title="Delete" onClick={() => void deletePortfolio(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table view ── */}
      {view === "table" && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead className="bg-card">
              <tr className="border-b border-border text-left">
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Project</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Category</th>
                <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">Location</th>
                <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">Year</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(item => (
                <tr key={item.id} {...dragProps(item)}
                  className={cn("cursor-grab transition active:cursor-grabbing",
                    draggingId === item.id ? "opacity-40 bg-muted/20" : "",
                    dragOverId === item.id ? "bg-accent/5 outline outline-1 outline-accent" : "hover:bg-muted/30")}>
                  <td className="px-2 py-3 text-center"><GripVertical className="h-4 w-4 mx-auto text-muted-foreground/40" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 shrink-0 overflow-hidden rounded bg-muted">
                        {item.featured_image ? <img src={item.featured_image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Image className="h-4 w-4 text-muted-foreground/40" /></div>}
                      </div>
                      <div>
                        <div className="font-medium">{item.title}</div>
                        {item.is_featured && <span className="text-[11px] text-accent">Featured</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.category || "—"}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{item.location || "—"}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{item.year || "—"}</td>
                  <td className="px-4 py-3"><Badge tone={item.status === "published" ? "success" : item.status === "archived" || item.status === "hidden" ? "warning" : "default"}>{item.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" title="Quick View" onClick={() => setPreview(item)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" title="View live page" onClick={() => viewFrontend(item)}><ExternalLink className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" title="Share" onClick={() => void share(item)}><Share2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" title="Edit" onClick={() => setDraft(itemToDraft(item))}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" title={item.status === "archived" ? "Unarchive" : "Archive"} onClick={() => void toggleArchive(item)}>{item.status === "archived" ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" title="Delete" onClick={() => void deletePortfolio(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Kanban view ── */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanCols.map(({ cat, items: colItems }) => (
            <div key={cat} className="flex w-64 shrink-0 flex-col gap-3"
              onDragOver={(e) => onDragOverCol(e, cat)} onDrop={(e) => onDropCol(e, cat)}>
              <div className={cn("flex items-center justify-between rounded-lg border px-3 py-2 transition",
                dragOverCol === cat ? "border-accent bg-accent/5" : "border-border bg-card")}>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{cat}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{colItems.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {colItems.map(item => (
                  <div key={item.id} {...dragProps(item, cat)}
                    className={cn("cursor-grab overflow-hidden rounded-xl border bg-card transition active:cursor-grabbing",
                      draggingId === item.id ? "opacity-40 scale-95" : "",
                      dragOverId === item.id ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40 hover:shadow-sm")}>
                    <div className="aspect-[16/9] bg-muted">
                      {item.featured_image ? <img src={item.featured_image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Image className="h-5 w-5 text-muted-foreground/30" /></div>}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-semibold leading-snug">{item.title}</span>
                        <Badge tone={item.status === "published" ? "success" : item.status === "archived" || item.status === "hidden" ? "warning" : "default"}>{item.status}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{item.year || "—"} · {item.location || "AZ"}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" title="Quick View" onClick={() => setPreview(item)}><Eye className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" title="View live page" onClick={() => viewFrontend(item)}><ExternalLink className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" title="Share" onClick={() => void share(item)}><Share2 className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" title="Edit" onClick={() => setDraft(itemToDraft(item))}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" title={item.status === "archived" ? "Unarchive" : "Archive"} onClick={() => void toggleArchive(item)}>{item.status === "archived" ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" title="Delete" onClick={() => void deletePortfolio(item)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div className={cn("flex h-16 items-center justify-center rounded-xl border-2 border-dashed text-xs text-muted-foreground transition",
                    dragOverCol === cat ? "border-accent bg-accent/5 text-accent" : "border-border")}>Drop here</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!filtered.length ? <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No portfolio items yet.</div> : null}

      {draft ? <PortfolioEditor draft={draft} saving={saving} onChange={setDraft} onClose={() => setDraft(null)} onSave={savePortfolio} /> : null}

      {preview ? <PortfolioPreviewModal item={preview} onClose={() => setPreview(null)} onEdit={(it) => { setPreview(null); setDraft(itemToDraft(it)); }} /> : null}

      {/* Trash dialog */}
      {trashMode ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
          <div className="my-8 w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold">Trash</h2>
                <span className="text-xs text-muted-foreground">Deleted items are kept here until you permanently delete them.</span>
              </div>
              <button type="button" onClick={() => setTrashMode(false)} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-4">
              {trashLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : trashItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Trash is empty.</div>
              ) : (
                <div className="divide-y divide-border">
                  {trashItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 py-3">
                      {item.featured_image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={item.featured_image} alt="" className="h-11 w-11 shrink-0 rounded-md border border-border object-cover" />
                        : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground"><Image className="h-4 w-4" /></span>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{[item.category, item.location].filter(Boolean).join(" · ") || "—"}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void restore(item)}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmPurge(item)}><Trash2 className="h-3.5 w-3.5" /> Delete forever</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm: move to Trash */}
      {confirmDelete ? (
        <ConfirmDialog
          icon={<Trash2 className="h-5 w-5 text-amber-500" />}
          title="Move to Trash?"
          body={<>“{confirmDelete.title}” will be moved to Trash. It stays out of the website and the dashboard list, but you can restore it anytime.</>}
          confirmLabel="Move to Trash"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void doDelete(confirmDelete)}
        />
      ) : null}

      {/* Confirm: permanent delete */}
      {confirmPurge ? (
        <ConfirmDialog
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          title="Delete permanently?"
          body={<>“{confirmPurge.title}” will be permanently deleted. This can’t be undone.</>}
          confirmLabel="Delete forever"
          destructive
          onCancel={() => setConfirmPurge(null)}
          onConfirm={() => void deleteForever(confirmPurge)}
        />
      ) : null}
    </div>
  );
}

function ConfirmDialog({ icon, title, body, confirmLabel, destructive, onCancel, onConfirm }: {
  icon: React.ReactNode; title: string; body: React.ReactNode; confirmLabel: string; destructive?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button size="sm" variant={destructive ? "outline" : "accent"} className={destructive ? "border-destructive/40 text-destructive hover:bg-destructive/10" : ""} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// Read-only preview of a portfolio item — works for any status (drafts included),
// unlike the public page which only renders published items.
function PortfolioPreviewModal({ item, onClose, onEdit }: { item: PortfolioItem; onClose: () => void; onEdit: (item: PortfolioItem) => void }) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const meta = [item.category, item.location, item.year ? String(item.year) : null, item.timeline, item.square_feet ? `${item.square_feet.toLocaleString()} sq ft` : null].filter(Boolean);
  const gallery = (item.gallery_images || []).filter(Boolean);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[16/9] bg-muted">
          {item.featured_image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={item.featured_image} alt={item.title} className="h-full w-full object-cover" />
            : <div className="grid h-full place-items-center text-muted-foreground"><Image className="h-10 w-10" /></div>}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <Badge tone={item.status === "published" ? "success" : item.status === "archived" || item.status === "hidden" ? "warning" : "default"}>{item.status}</Badge>
            <button type="button" onClick={onClose} className="rounded-full bg-black/55 p-2 text-white shadow-md backdrop-blur transition hover:bg-black/75" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-6">
          {item.subtitle ? <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{item.subtitle}</div> : null}
          <h2 className="font-display text-2xl font-semibold">{item.title}</h2>
          {meta.length ? <div className="mt-2 text-sm text-muted-foreground">{meta.join(" · ")}</div> : null}
          {item.description ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground">{item.description}</p> : null}

          {(item.services_used || []).length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.services_used!.map((s) => <Badge key={s}>{s}</Badge>)}
            </div>
          ) : null}

          {(item.attributes_json || []).length ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {item.attributes_json!.map((a, i) => (
                <div key={i}><dt className="text-xs text-muted-foreground">{a.label}</dt><dd className="text-foreground">{a.value}</dd></div>
              ))}
            </dl>
          ) : null}

          {gallery.length ? (
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Gallery ({gallery.length})</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {gallery.map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={g} alt="" className="aspect-square w-full rounded-md border border-border object-cover" />
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
          <div>
            {item.status === "published" ? (
              <a href={`/portfolio/${item.slug || item.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                Open public page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Not on the public site ({item.status})</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
            <Button size="sm" variant="accent" onClick={() => onEdit(item)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioEditor({ draft, saving, onChange, onClose, onSave }: { draft: Draft; saving: boolean; onChange: (draft: Draft) => void; onClose: () => void; onSave: (draft: Draft) => void }) {
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  // Slug is auto-generated from the title unless the user opts into a custom one.
  const [customSlug, setCustomSlug] = React.useState(() => !!draft.slug && draft.slug !== slugify(draft.title));

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange({ ...draft, [key]: value });
  const upload = async (field: "featured_image" | "gallery_images" | "video_urls", file: File | null) => {
    if (!file) return;
    setUploading(field);
    setUploadError(null);
    try {
      const media = await uploadMedia(file, "portfolio");
      if (field === "featured_image") update("featured_image", media.url);
      if (field === "gallery_images") update("gallery_images", [...(draft.gallery_images || []), media.url]);
      if (field === "video_urls") update("video_urls", [...(draft.video_urls || []), media.url]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  };
  // Upload every selected file, then append them all in one update — so
  // concurrent appends can't race and drop all but the last image.
  const uploadMany = async (field: "gallery_images" | "video_urls", files: File[]) => {
    if (!files.length) return;
    setUploading(field);
    setUploadError(null);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push((await uploadMedia(f, "portfolio")).url);
      const current = (field === "gallery_images" ? draft.gallery_images : draft.video_urls) || [];
      onChange({ ...draft, [field]: [...current, ...urls] });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4">
      <div className="mx-auto my-8 max-w-5xl overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Portfolio</div>
            <h2 className="mt-2 font-display text-2xl font-semibold">{draft.id ? `Edit: ${draft.title}` : "Add Portfolio Item"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create the dashboard record once, then publish it to the public portfolio archive and detail page.</p>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-md border border-border hover:bg-muted" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Project Title *</span>
            <Input value={draft.title} onChange={event => onChange({ ...draft, title: event.target.value })} />
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Page URL</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={customSlug} onChange={event => {
                  const on = event.target.checked;
                  setCustomSlug(on);
                  onChange({ ...draft, slug: on ? (draft.slug || slugify(draft.title)) : "" });
                }} />
                Custom slug
              </label>
            </div>
            {customSlug ? (
              <Input value={draft.slug || ""} onChange={event => update("slug", event.target.value)} placeholder="portfolio-page-url" />
            ) : (
              <div className="truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" title="Auto-generated from the title">
                /portfolio/<span className="text-foreground">{slugify(draft.title) || "auto-generated-on-save"}</span>
              </div>
            )}
          </div>
          <label className="space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Subtitle</span>
            <Input value={draft.subtitle || ""} onChange={event => update("subtitle", event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Location</span>
            <Input value={draft.location || ""} onChange={event => update("location", event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Category</span>
            <Select value={draft.category || ""} onChange={event => update("category", event.target.value)}>
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </Select>
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Year</span>
              <Input type="number" value={draft.year || ""} onChange={event => update("year", Number(event.target.value) || null)} />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Timeline</span>
              <Input value={draft.timeline || ""} onChange={event => update("timeline", event.target.value)} />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Square Feet</span>
              <Input type="number" value={draft.square_feet || ""} onChange={event => update("square_feet", Number(event.target.value) || null)} />
            </label>
          </div>
          <label className="space-y-2 lg:col-span-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Description</span>
            <Textarea className="min-h-32" value={draft.description || ""} onChange={event => update("description", event.target.value)} />
          </label>

          <MediaUpload label="Featured Image" icon={Image} uploading={uploading === "featured_image"} url={draft.featured_image || ""} accept="image/*" onFile={file => upload("featured_image", file)} onUrl={value => update("featured_image", value)} />
          <MediaUpload label="Gallery Images" icon={Upload} uploading={uploading === "gallery_images"} url={(draft.gallery_images || []).join("\n")} accept="image/*" multiple onFile={file => upload("gallery_images", file)} onFiles={files => uploadMany("gallery_images", files)} onUrl={value => update("gallery_images", lines(value))} textarea />
          <MediaUpload label="Videos" icon={Video} uploading={uploading === "video_urls"} url={(draft.video_urls || []).join("\n")} accept="video/*" multiple onFile={file => upload("video_urls", file)} onFiles={files => uploadMany("video_urls", files)} onUrl={value => update("video_urls", lines(value))} textarea />
          {uploadError ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive lg:col-span-2">{uploadError}</div> : null}

          <TagPicker title="Services Used" values={draft.services_used || []} options={serviceOptions} onChange={value => update("services_used", value)} />
          <AttributesEditor values={draft.attributes_json || []} onChange={value => update("attributes_json", value)} />

          <div className="grid gap-3 md:grid-cols-3 lg:col-span-2">
            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Status</span>
              <Select value={draft.status || "draft"} onChange={event => update("status", event.target.value as PortfolioStatus)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </Select>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
              <input type="checkbox" checked={Boolean(draft.is_featured)} onChange={event => update("is_featured", event.target.checked)} />
              Featured
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
              <input type="checkbox" checked={draft.client_visible !== false} onChange={event => update("client_visible", event.target.checked)} />
              Public visible
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border p-5">
          <Button onClick={() => onSave(draft)} disabled={saving || !draft.title}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Portfolio Item
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function MediaUpload({ label, icon: Icon, uploading, url, accept, multiple, textarea, onFile, onFiles, onUrl }: { label: string; icon: LucideIcon; uploading: boolean; url: string; accept: string; multiple?: boolean; textarea?: boolean; onFile: (file: File | null) => void; onFiles?: (files: File[]) => void; onUrl: (value: string) => void }) {
  const [showUrl, setShowUrl] = React.useState(false);
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-accent" /> {label}</div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showUrl} onChange={event => setShowUrl(event.target.checked)} />
          URL option
        </label>
      </div>
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-card p-4 text-center text-sm transition hover:border-accent hover:bg-accent/5">
        {uploading ? <Loader2 className="mb-2 h-5 w-5 animate-spin text-accent" /> : <Upload className="mb-2 h-5 w-5 text-accent" />}
        <span className="font-medium">Upload {label.toLowerCase()}</span>
        <span className="mt-1 text-xs text-muted-foreground">Supports light and dark mode previews through Supabase Storage URLs.</span>
        <input type="file" className="sr-only" accept={accept} multiple={multiple} onChange={event => {
          const files = Array.from(event.target.files || []);
          if (multiple && onFiles) onFiles(files);
          else files.forEach(file => onFile(file));
          event.currentTarget.value = "";
        }} />
      </label>
      {showUrl ? textarea ? <Textarea value={url} onChange={event => onUrl(event.target.value)} placeholder="https://..." /> : <Input value={url} onChange={event => onUrl(event.target.value)} placeholder="https://..." /> : null}
      {url ? <pre className="max-h-24 overflow-auto rounded-md bg-card p-2 text-[11px] text-muted-foreground">{url}</pre> : null}
    </div>
  );
}

function TagPicker({ title, values, options, onChange }: { title: string; values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="space-y-3 lg:col-span-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = values.includes(option);
          return (
            <button key={option} type="button" className={cn("rounded-full border px-3 py-1 text-xs transition hover:border-accent", active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground")} onClick={() => onChange(active ? values.filter(value => value !== option) : [...values, option])}>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AttributesEditor({ values, onChange }: { values: PortfolioAttribute[]; onChange: (values: PortfolioAttribute[]) => void }) {
  return (
    <div className="space-y-3 lg:col-span-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Project Attributes</div>
        <Button size="sm" variant="outline" onClick={() => onChange([...values, { label: "", value: "" }])}><Plus className="h-3.5 w-3.5" /> Add Attribute</Button>
      </div>
      <div className="space-y-2">
        {values.map((row, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input value={row.label} placeholder="Attribute title" onChange={event => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
            <Input value={row.value} placeholder="Attribute value" onChange={event => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />
            <Button variant="outline" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}><X className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function lines(value: string) {
  return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
}

async function uploadMedia(file: File, folder: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
  const json = await res.json().catch(() => ({ message: "Upload failed." }));
  if (!res.ok) throw new Error(json.message || "Upload failed.");
  return json as { url: string };
}
