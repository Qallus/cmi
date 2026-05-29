"use client";

import * as React from "react";
import { CheckCircle2, Eye, EyeOff, Image, Loader2, Pencil, Plus, Share2, Trash2, Upload, Video, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(demoMode ? "Demo mode: portfolio changes are local until Supabase is configured." : null);

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

  async function deletePortfolio(item: PortfolioItem) {
    if (!confirm(`Delete ${item.title}?`)) return;
    if (demoMode) {
      setItems(current => current.filter(row => row.id !== item.id));
      return;
    }
    const res = await fetch(`/api/admin/portfolio/${item.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setNotice(json.message || "Portfolio delete failed.");
      return;
    }
    setItems(current => current.filter(row => row.id !== item.id));
  }

  async function quickStatus(item: PortfolioItem, status: PortfolioStatus) {
    await savePortfolio({ ...itemToDraft(item), status });
  }

  async function share(item: PortfolioItem) {
    const url = `${window.location.origin}/portfolio/${item.slug || item.id}`;
    await navigator.clipboard?.writeText(url);
    setNotice(`Copied portfolio link: ${url}`);
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Work</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Manage dashboard-driven project stories, media, categories, and public visibility from one place.</p>
        </div>
        <Button onClick={() => setDraft({ ...emptyDraft })}>
          <Plus className="h-4 w-4" />
          Add Portfolio
        </Button>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filtered.map(item => (
          <Card key={item.id} className="overflow-hidden">
            <div className="aspect-[4/3] bg-muted">
              {item.featured_image ? <img src={item.featured_image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Image className="h-8 w-8" /></div>}
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{item.title}</h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.category || "Uncategorized"} · {item.year || "No year"}</p>
                </div>
                <Badge tone={item.status === "published" ? "success" : item.status === "hidden" ? "warning" : "default"}>{item.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {item.is_featured ? <Badge tone="accent">Featured</Badge> : null}
                {(item.gallery_images || []).length ? <Badge>{item.gallery_images?.length} images</Badge> : null}
                {(item.video_urls || []).length ? <Badge>{item.video_urls?.length} videos</Badge> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft(itemToDraft(item))}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => share(item)}><Share2 className="h-3.5 w-3.5" /> Share</Button>
                <Button size="sm" variant="outline" onClick={() => quickStatus(item, item.status === "hidden" ? "published" : "hidden")}>{item.status === "hidden" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {item.status === "hidden" ? "Show" : "Hide"}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePortfolio(item)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {!filtered.length ? <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No portfolio items yet.</div> : null}

      {draft ? <PortfolioEditor draft={draft} saving={saving} onChange={setDraft} onClose={() => setDraft(null)} onSave={savePortfolio} /> : null}
    </div>
  );
}

function PortfolioEditor({ draft, saving, onChange, onClose, onSave }: { draft: Draft; saving: boolean; onChange: (draft: Draft) => void; onClose: () => void; onSave: (draft: Draft) => void }) {
  const [uploading, setUploading] = React.useState<string | null>(null);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange({ ...draft, [key]: value });
  const upload = async (field: "featured_image" | "gallery_images" | "video_urls", file: File | null) => {
    if (!file) return;
    setUploading(field);
    try {
      const media = await uploadMedia(file, "portfolio");
      if (field === "featured_image") update("featured_image", media.url);
      if (field === "gallery_images") update("gallery_images", [...(draft.gallery_images || []), media.url]);
      if (field === "video_urls") update("video_urls", [...(draft.video_urls || []), media.url]);
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
            <Input value={draft.title} onChange={event => {
              const title = event.target.value;
              onChange({ ...draft, title, slug: draft.slug ? draft.slug : slugify(title) });
            }} />
          </label>
          <label className="space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Slug</span>
            <Input value={draft.slug || ""} onChange={event => update("slug", event.target.value)} placeholder="portfolio-page-url" />
          </label>
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
          <MediaUpload label="Gallery Images" icon={Upload} uploading={uploading === "gallery_images"} url={(draft.gallery_images || []).join("\n")} accept="image/*" multiple onFile={file => upload("gallery_images", file)} onUrl={value => update("gallery_images", lines(value))} textarea />
          <MediaUpload label="Videos" icon={Video} uploading={uploading === "video_urls"} url={(draft.video_urls || []).join("\n")} accept="video/*" multiple onFile={file => upload("video_urls", file)} onUrl={value => update("video_urls", lines(value))} textarea />

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

function MediaUpload({ label, icon: Icon, uploading, url, accept, multiple, textarea, onFile, onUrl }: { label: string; icon: LucideIcon; uploading: boolean; url: string; accept: string; multiple?: boolean; textarea?: boolean; onFile: (file: File | null) => void; onUrl: (value: string) => void }) {
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
        <input type="file" className="sr-only" accept={accept} multiple={multiple} onChange={event => Array.from(event.target.files || []).forEach(file => onFile(file))} />
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
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Upload failed.");
  return json as { url: string };
}
