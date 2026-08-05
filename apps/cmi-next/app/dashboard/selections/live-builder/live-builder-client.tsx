"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, CheckCircle2, ChevronDown, ExternalLink, Eye, Info, Loader2, Monitor, Package, Plus, Smartphone, Sparkles, Star, Tablet, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BuilderVendor = { id: string; name: string; website_url: string | null; logo_url: string | null; category: string | null; status: string | null };
export type BuilderOption = { id: string; label: string; sublabel: string | null };

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };

const FIELD =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";
const LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

const STATUSES = [
  ["draft", "Draft"], ["needs_review", "Under Review"], ["pending_client_approval", "Client Review"],
  ["rejected_needs_revision", "Changes Requested"], ["approved_internally", "Approved"], ["ordered", "Ordered"],
  ["backordered", "Backordered"], ["delivered", "Received"], ["installed", "Installed"], ["canceled", "Declined"], ["replaced", "Replaced"],
] as const;
const PRICE_TYPES = [
  ["exact", "Exact"], ["starting_at", "Starting at"], ["estimated", "Estimated"], ["allowance", "Allowance"],
  ["contact_vendor", "Contact vendor"], ["not_available", "Not available"],
] as const;
const PRIORITIES = [["low", "Low"], ["medium", "Medium"], ["high", "High"], ["urgent", "Urgent"]] as const;

type Extracted = {
  title: string | null;
  descriptions: string[];
  image: string | null;
  images: string[];
  price: string | null;
  currency: string | null;
  sku: string | null;
  model: string | null;
  manufacturer: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  features: string[];
  sourceUrl: string;
};

const EMPTY = {
  title: "", vendor_id: "", vendor_name: "", short_description: "", image_url: "", long_description: "",
  price: "", price_type: "exact", currency: "USD", product_url: "", sku: "", model_number: "", manufacturer: "",
  category: "", subcategory: "", finish: "", color: "", material: "", dimensions: "", quantity: "1", unit: "",
  lead_time_days: "", availability: "", features: "", gallery_urls: "", priority: "medium", status: "draft",
  required: false, client_visible: false, creator_notes: "", client_notes: "", tags: "",
  exterior_colors: "", interior_colors: "",
  job_id: "", project_id: "", task_id: "",
};
type Form = typeof EMPTY;

export function LiveBuilderClient({ vendors, jobs, projects }: { vendors: BuilderVendor[]; jobs: BuilderOption[]; projects: BuilderOption[] }) {
  const [url, setUrl] = React.useState("");
  const [loadedUrl, setLoadedUrl] = React.useState("");
  const [device, setDevice] = React.useState<Device>("desktop");
  const [extracting, setExtracting] = React.useState(false);
  const [extractMsg, setExtractMsg] = React.useState<string | null>(null);
  const [detected, setDetected] = React.useState<Extracted | null>(null);
  const [centerTab, setCenterTab] = React.useState<"detected" | "preview">("preview");
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const [openSections, setOpenSections] = React.useState<Set<string>>(new Set(["product"]));
  function toggleSection(id: string) {
    setOpenSections((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function mark(key: string) {
    setAdded((s) => new Set(s).add(key));
  }

  // Click-to-add mapping: each detected element writes into a card field.
  function addField<K extends keyof Form>(chipKey: string, formKey: K, value: string) {
    set(formKey, value as Form[K]);
    mark(chipKey);
  }
  function galleryList(): string[] {
    return form.gallery_urls.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  function toggleGallery(imgUrl: string) {
    const list = galleryList();
    const next = list.includes(imgUrl) ? list.filter((u) => u !== imgUrl) : [...list, imgUrl];
    set("gallery_urls", next.join("\n"));
  }
  function addFeature(line: string) {
    const list = form.features.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!list.includes(line)) set("features", [...list, line].join("\n"));
    mark(`feat:${line}`);
  }
  function autofillAll(d: Extracted) {
    setForm((f) => ({
      ...f,
      title: d.title ?? f.title,
      short_description: d.descriptions[0] ?? f.short_description,
      long_description: d.descriptions[1] ?? f.long_description,
      image_url: d.image ?? f.image_url,
      gallery_urls: d.images.length ? d.images.join("\n") : f.gallery_urls,
      price: d.price ?? f.price,
      currency: d.currency ?? f.currency,
      sku: d.sku ?? f.sku,
      model_number: d.model ?? f.model_number,
      manufacturer: d.manufacturer ?? f.manufacturer,
      category: d.category ?? f.category,
      color: d.color ?? f.color,
      material: d.material ?? f.material,
      features: d.features.length ? d.features.join("\n") : f.features,
      product_url: d.sourceUrl ?? f.product_url,
    }));
    setOpenSections(new Set(["product", "pricing", "details", "customization", "media", "status"]));
  }

  function pickVendor(id: string) {
    const v = vendors.find((x) => x.id === id);
    set("vendor_id", id);
    set("vendor_name", v?.name ?? "");
    if (v?.website_url && !url) setUrl(v.website_url);
  }

  function loadPage() {
    if (!/^https?:\/\//i.test(url.trim())) { setExtractMsg("Enter a valid http(s) URL."); return; }
    setExtractMsg(null);
    setLoadedUrl(url.trim());
  }

  async function extract() {
    const target = (url || loadedUrl).trim();
    if (!/^https?:\/\//i.test(target)) { setExtractMsg("Enter a valid http(s) URL first."); return; }
    setExtracting(true); setExtractMsg(null);
    try {
      const res = await fetch("/api/selections/extract", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: target }),
      });
      const json = await res.json() as { ok: boolean; found?: boolean; data?: Extracted; message?: string };
      if (!json.ok || !json.data) { setExtractMsg(json.message ?? "Could not extract product info. Enter details manually."); return; }
      setDetected(json.data);
      setCenterTab("detected");
      setExtractMsg(json.found === false ? (json.message ?? "No product metadata found — enter details manually.") : "Click detected elements to add them to the card.");
    } catch {
      setExtractMsg("Extraction failed. Open the page in a new tab and enter details manually.");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    setError("");
    if (!form.title.trim()) { setError("Product title is required."); return; }
    if (!form.vendor_id && !form.vendor_name.trim()) { setError("Vendor is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/selections/live", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source_url: loadedUrl || url || form.product_url }),
      });
      const json = await res.json() as { selection?: { id: string }; error?: string };
      if (!res.ok || !json.selection) throw new Error(json.error ?? "Save failed.");
      setSavedId(json.selection.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm(EMPTY); setUrl(""); setLoadedUrl(""); setDetected(null); setAdded(new Set()); setCenterTab("preview"); setExtractMsg(null); setSavedId(null); setError("");
  }

  if (savedId) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="h-6 w-6 text-accent" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Selection saved</h1>
        <p className="mt-2 text-sm text-muted-foreground">The Selection Card was added to your library{form.job_id ? " and attached to the job" : ""}.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="accent" onClick={reset}><Sparkles className="h-4 w-4" /> Build another</Button>
          <Link href="/dashboard/selections"><Button variant="outline">Go to Selections</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/selections" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Selections</div>
            <h1 className="font-display text-lg font-semibold tracking-tight">Live Selection Builder</h1>
          </div>
        </div>
        <Button variant="accent" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Selection
        </Button>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_1fr_360px]">
        {/* Left — controls */}
        <aside className="overflow-y-auto border-r border-border p-4 space-y-5">
          <div>
            <label className={LABEL}>Vendor Source</label>
            <select className={FIELD} value={form.vendor_id} onChange={(e) => pickVendor(e.target.value)}>
              <option value="">Select a vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.category ? ` — ${v.category}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Vendor or Product URL</label>
            <input className={FIELD} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={loadPage}>Load page</Button>
              <Button size="sm" variant="accent" className="flex-1" onClick={() => void extract()} disabled={extracting}>
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Extract
              </Button>
            </div>
          </div>

          <div>
            <label className={LABEL}>Device Preview</label>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
                <button key={d} type="button" onClick={() => setDevice(d)}
                  className={`flex flex-1 items-center justify-center rounded-md py-1.5 text-xs capitalize transition ${device === d ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mb-1 h-3.5 w-3.5 text-accent" />
            Review-only workflow. Selecting page content creates Selection Cards. This tool never edits or publishes the vendor website.
          </div>
        </aside>

        {/* Center — canvas: Detected Elements picker + live preview */}
        <main className="flex flex-col overflow-hidden bg-muted/20">
          <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
            <div className="flex gap-1">
              <button type="button" onClick={() => setCenterTab("detected")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${centerTab === "detected" ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                Detected Elements{detected ? "" : " (run Extract)"}
              </button>
              <button type="button" onClick={() => setCenterTab("preview")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${centerTab === "preview" ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                Live Preview
              </button>
            </div>
            {(loadedUrl || detected?.sourceUrl) && (
              <a href={loadedUrl || detected?.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs text-accent hover:underline">
                Open Original <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {centerTab === "preview" ? (
              !loadedUrl ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <Sparkles className="mb-3 h-8 w-8 text-accent/60" />
                  <p className="max-w-xs">Pick a vendor or paste a product URL, then <strong>Load page</strong> to preview it — or <strong>Extract</strong> to detect its content.</p>
                </div>
              ) : (
                <div className="mx-auto h-full overflow-hidden rounded-lg border border-border bg-white shadow-sm transition-all" style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}>
                  <iframe key={loadedUrl} src={loadedUrl} title="Vendor page preview" className="h-full min-h-[600px] w-full" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer" />
                </div>
              )
            ) : !detected ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <Wand2 className="mb-3 h-8 w-8 text-accent/60" />
                <p className="max-w-xs">Enter a product URL and hit <strong>Extract</strong>. Detected title, price, images, and specs will appear here to click into your card.</p>
              </div>
            ) : (
              <DetectedPanel
                d={detected}
                added={added}
                featured={form.image_url}
                gallery={galleryList()}
                onAutofill={() => autofillAll(detected)}
                onTitle={(v) => addField("title", "title", v)}
                onPrice={(v) => { addField("price", "price", v); if (detected.currency) set("currency", detected.currency); }}
                onShort={(v) => addField("short", "short_description", v)}
                onLong={(v) => addField("long", "long_description", v)}
                onSku={(v) => addField("sku", "sku", v)}
                onModel={(v) => addField("model", "model_number", v)}
                onManufacturer={(v) => addField("mfr", "manufacturer", v)}
                onCategory={(v) => addField("cat", "category", v)}
                onColor={(v) => addField("color", "color", v)}
                onMaterial={(v) => addField("material", "material", v)}
                onFeatured={(v) => { set("image_url", v); mark(`img:${v}`); }}
                onToggleGallery={toggleGallery}
                onFeature={addFeature}
              />
            )}
          </div>
        </main>

        {/* Right — live Card Preview + collapsible editor */}
        <aside className="overflow-y-auto border-l border-border p-4 space-y-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Selection Card</div>
          {extractMsg && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${detected ? "border-accent/40 bg-accent/5 text-accent" : "border-border bg-muted/40 text-muted-foreground"}`}>{extractMsg}</div>
          )}

          {/* Live preview — builds in real-time as elements are added */}
          <CardPreview form={form} gallery={galleryList()} jobs={jobs} onSetJob={(id) => set("job_id", id)} onSave={save} saving={saving} />

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

          {/* Accordion editor */}
          <div className="space-y-2">
            <AccSection id="product" title="Product" open={openSections.has("product")} onToggle={toggleSection}>
              <div><label className={LABEL}>Product Title *</label><input className={FIELD} value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
              <div>
                <label className={LABEL}>Vendor *</label>
                <input className={FIELD} value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} placeholder="Vendor name" />
              </div>
              <div><label className={LABEL}>Short Description *</label><textarea className={`${FIELD} resize-none`} rows={2} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} /></div>
              <div><label className={LABEL}>Featured Image URL *</label><input className={FIELD} value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" /></div>
            </AccSection>

            <AccSection id="pricing" title="Pricing" open={openSections.has("pricing")} onToggle={toggleSection}>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL}>Price</label><input className={FIELD} value={form.price} onChange={(e) => set("price", e.target.value)} /></div>
                <div><label className={LABEL}>Currency</label><input className={FIELD} value={form.currency} onChange={(e) => set("currency", e.target.value)} /></div>
              </div>
              <div><label className={LABEL}>Price Type</label><select className={FIELD} value={form.price_type} onChange={(e) => set("price_type", e.target.value)}>{PRICE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </AccSection>

            <AccSection id="details" title="Details & Specs" open={openSections.has("details")} onToggle={toggleSection}>
              <div><label className={LABEL}>Long Description</label><textarea className={`${FIELD} resize-none`} rows={3} value={form.long_description} onChange={(e) => set("long_description", e.target.value)} /></div>
              <div><label className={LABEL}>Product URL</label><input className={FIELD} value={form.product_url} onChange={(e) => set("product_url", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL}>SKU</label><input className={FIELD} value={form.sku} onChange={(e) => set("sku", e.target.value)} /></div>
                <div><label className={LABEL}>Model #</label><input className={FIELD} value={form.model_number} onChange={(e) => set("model_number", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL}>Manufacturer</label><input className={FIELD} value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></div>
                <div><label className={LABEL}>Category</label><input className={FIELD} value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL}>Material</label><input className={FIELD} value={form.material} onChange={(e) => set("material", e.target.value)} /></div>
                <div><label className={LABEL}>Dimensions</label><input className={FIELD} value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL}>Quantity</label><input className={FIELD} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} /></div>
                <div><label className={LABEL}>Unit</label><input className={FIELD} value={form.unit} onChange={(e) => set("unit", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL}>Lead time (days)</label><input className={FIELD} value={form.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} /></div>
                <div><label className={LABEL}>Availability</label><input className={FIELD} value={form.availability} onChange={(e) => set("availability", e.target.value)} /></div>
              </div>
            </AccSection>

            <AccSection id="customization" title="Customization Options" open={openSections.has("customization")} onToggle={toggleSection}>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL}>Color</label><input className={FIELD} value={form.color} onChange={(e) => set("color", e.target.value)} /></div>
                <div><label className={LABEL}>Finish</label><input className={FIELD} value={form.finish} onChange={(e) => set("finish", e.target.value)} /></div>
              </div>
              <div><label className={LABEL}>Exterior Colors (comma separated)</label><input className={FIELD} value={form.exterior_colors} onChange={(e) => set("exterior_colors", e.target.value)} placeholder="White, Sandtone, Terratone…" /></div>
              <div><label className={LABEL}>Interior Colors (comma separated)</label><input className={FIELD} value={form.interior_colors} onChange={(e) => set("interior_colors", e.target.value)} placeholder="White, Maple, Oak…" /></div>
            </AccSection>

            <AccSection id="media" title="Features & Gallery" open={openSections.has("media")} onToggle={toggleSection}>
              <div><label className={LABEL}>Features (one per line)</label><textarea className={`${FIELD} resize-none`} rows={3} value={form.features} onChange={(e) => set("features", e.target.value)} /></div>
              <div><label className={LABEL}>Gallery image URLs (one per line)</label><textarea className={`${FIELD} resize-none`} rows={2} value={form.gallery_urls} onChange={(e) => set("gallery_urls", e.target.value)} /></div>
            </AccSection>

            <AccSection id="status" title="Status & Visibility" open={openSections.has("status")} onToggle={toggleSection}>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL}>Status</label><select className={FIELD} value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div><label className={LABEL}>Priority</label><select className={FIELD} value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.client_visible} onChange={(e) => set("client_visible", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /><Eye className="h-3.5 w-3.5 text-muted-foreground" /> Visible to client</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.required} onChange={(e) => set("required", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Required selection</label>
              <div><label className={LABEL}>Tags (comma separated)</label><input className={FIELD} value={form.tags} onChange={(e) => set("tags", e.target.value)} /></div>
            </AccSection>

            <AccSection id="association" title="Attach to" open={openSections.has("association")} onToggle={toggleSection}>
              <div><label className={LABEL}>Job</label><select className={FIELD} value={form.job_id} onChange={(e) => set("job_id", e.target.value)}><option value="">— None —</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}</select></div>
              <div><label className={LABEL}>Project</label><select className={FIELD} value={form.project_id} onChange={(e) => set("project_id", e.target.value)}><option value="">— None —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
            </AccSection>

            <AccSection id="notes" title="Notes" open={openSections.has("notes")} onToggle={toggleSection}>
              <div><label className={LABEL}>Internal (creator) notes</label><textarea className={`${FIELD} resize-none`} rows={2} value={form.creator_notes} onChange={(e) => set("creator_notes", e.target.value)} placeholder="Never shown to clients" /></div>
              <div><label className={LABEL}>Client-facing notes</label><textarea className={`${FIELD} resize-none`} rows={2} value={form.client_notes} onChange={(e) => set("client_notes", e.target.value)} /></div>
            </AccSection>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AddBtn({ done, onClick, label = "Add" }: { done: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
        done ? "bg-accent/15 text-accent" : "border border-border text-muted-foreground hover:border-accent hover:text-accent"
      }`}
    >
      {done ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {done ? "Added" : label}
    </button>
  );
}

// The on-canvas "selector": detected page elements as click-to-add chips.
// Clicking a chip maps that value into the Selection Card (right column) live.
function DetectedPanel(props: {
  d: Extracted;
  added: Set<string>;
  featured: string;
  gallery: string[];
  onAutofill: () => void;
  onTitle: (v: string) => void;
  onPrice: (v: string) => void;
  onShort: (v: string) => void;
  onLong: (v: string) => void;
  onSku: (v: string) => void;
  onModel: (v: string) => void;
  onManufacturer: (v: string) => void;
  onCategory: (v: string) => void;
  onColor: (v: string) => void;
  onMaterial: (v: string) => void;
  onFeatured: (v: string) => void;
  onToggleGallery: (v: string) => void;
  onFeature: (v: string) => void;
}) {
  const { d, added, featured, gallery } = props;

  const scalarChips: { k: string; label: string; value: string | null; onAdd: (v: string) => void }[] = [
    { k: "title", label: "Product title", value: d.title, onAdd: props.onTitle },
    { k: "price", label: `Price${d.currency ? ` (${d.currency})` : ""}`, value: d.price, onAdd: props.onPrice },
    { k: "sku", label: "SKU", value: d.sku, onAdd: props.onSku },
    { k: "model", label: "Model #", value: d.model, onAdd: props.onModel },
    { k: "mfr", label: "Manufacturer / Brand", value: d.manufacturer, onAdd: props.onManufacturer },
    { k: "cat", label: "Category", value: d.category, onAdd: props.onCategory },
    { k: "color", label: "Color", value: d.color, onAdd: props.onColor },
    { k: "material", label: "Material", value: d.material, onAdd: props.onMaterial },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Click any element to add it to the Selection Card.</p>
        <Button size="sm" variant="outline" onClick={props.onAutofill}><Wand2 className="h-3.5 w-3.5" /> Auto-fill all</Button>
      </div>

      {/* Images */}
      {d.images.length > 0 && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Images ({d.images.length})</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {d.images.map((img) => {
              const isFeatured = featured === img;
              const inGallery = gallery.includes(img);
              return (
                <div key={img} className={`relative overflow-hidden rounded-lg border-2 bg-card ${isFeatured ? "border-accent" : "border-border"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-24 w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-1.5 py-1 text-[10px] font-medium text-white">
                    <button type="button" onClick={() => props.onFeatured(img)} className="inline-flex items-center gap-0.5 hover:text-accent">
                      <Star className={`h-3 w-3 ${isFeatured ? "fill-accent text-accent" : ""}`} /> {isFeatured ? "Featured" : "Feature"}
                    </button>
                    <button type="button" onClick={() => props.onToggleGallery(img)} className="inline-flex items-center gap-0.5 hover:text-accent">
                      {inGallery ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />} Gallery
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Descriptions */}
      {d.descriptions.length > 0 && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descriptions</div>
          <div className="space-y-2">
            {d.descriptions.map((desc, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
                <p className="min-w-0 flex-1 text-sm leading-relaxed">{desc}</p>
                <div className="flex shrink-0 flex-col gap-1">
                  <AddBtn done={added.has("short")} onClick={() => props.onShort(desc)} label="Short" />
                  <AddBtn done={added.has("long")} onClick={() => props.onLong(desc)} label="Long" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scalar fields */}
      {scalarChips.some((c) => c.value) && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Details</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {scalarChips.filter((c) => c.value).map((c) => (
              <div key={c.k} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
                  <div className="truncate text-sm" title={c.value ?? ""}>{c.value}</div>
                </div>
                <AddBtn done={added.has(c.k)} onClick={() => c.onAdd(c.value as string)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Features */}
      {d.features.length > 0 && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Features / Specs</div>
          <div className="space-y-1.5">
            {d.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm">{f}</span>
                <AddBtn done={added.has(`feat:${f}`)} onClick={() => props.onFeature(f)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Collapsible editor section (accordion). Card preview above updates live as
// fields change, so the user watches the card build.
function AccSection({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button type="button" onClick={() => onToggle(id)} className="flex w-full items-center justify-between bg-muted/30 px-3 py-2.5 text-left text-xs font-semibold text-foreground transition hover:bg-muted/50">
        {title}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="space-y-3 border-t border-border p-3">{children}</div>}
    </div>
  );
}

function SwatchRow({ label, colors }: { label: string; colors: string[] }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <span key={c} title={c} className="h-5 w-5 rounded-full border border-border" style={{ background: cssColor(c) }} />
        ))}
      </div>
    </div>
  );
}

// Best-effort map of a color name to a CSS value; falls back to a neutral chip.
function cssColor(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, "");
  const known: Record<string, string> = {
    white: "#f5f5f0", black: "#1a1a1a", sandtone: "#d9c7a3", terratone: "#8a6d4b", canvas: "#e7e2d6",
    bronze: "#5c4a35", forest: "#2f4231", forestgreen: "#2f4231", maple: "#c9975b", oak: "#b78a52",
    gray: "#9ca3af", grey: "#9ca3af", cocoa: "#5b4636", clay: "#b0876a", pinegreen: "#33503b",
  };
  if (known[n]) return known[n];
  if (typeof window !== "undefined" && typeof CSS !== "undefined" && CSS.supports("color", name)) return name;
  return "linear-gradient(135deg,#e5e1d8,#c9c2b3)";
}

// The polished, client-ready Selection Card preview — builds in real-time.
function CardPreview({ form, gallery, jobs, onSetJob, onSave, saving }: {
  form: Form; gallery: string[]; jobs: BuilderOption[]; onSetJob: (id: string) => void; onSave: () => void; saving: boolean;
}) {
  const ext = form.exterior_colors.split(",").map((s) => s.trim()).filter(Boolean);
  const intr = form.interior_colors.split(",").map((s) => s.trim()).filter(Boolean);
  const priceLabel = form.price ? `${form.currency && form.currency !== "USD" ? form.currency + " " : "$"}${form.price}` : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Media */}
      <div className="flex gap-3 p-4">
        <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30" style={{ minHeight: 176 }}>
          {form.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.image_url} alt="" className="h-44 w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground"><Package className="h-7 w-7" /><span className="text-xs">Featured image</span></div>
          )}
        </div>
        {gallery.length > 0 && (
          <div className="flex max-h-44 w-14 shrink-0 flex-col gap-2 overflow-y-auto">
            {gallery.slice(0, 6).map((g) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={g} src={g} alt="" className="h-12 w-14 shrink-0 rounded border border-border object-cover" />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="space-y-3 border-t border-border p-4">
        <div>
          <h3 className="font-display text-lg font-semibold leading-tight">{form.title || <span className="text-muted-foreground">Product title</span>}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {form.vendor_name && <span>{form.vendor_name}</span>}
            {priceLabel && <span className="font-semibold text-foreground">{priceLabel}</span>}
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{form.short_description || "Short description will appear here as you build the card."}</p>

        {(ext.length > 0 || intr.length > 0) && (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Customization Options</div>
            {ext.length > 0 && <SwatchRow label="Exterior Colors" colors={ext} />}
            {intr.length > 0 && <SwatchRow label="Interior Colors" colors={intr} />}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="accent" className="flex-1" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Selection Card
          </Button>
          <select value={form.job_id} onChange={(e) => onSetJob(e.target.value)} className="w-32 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-accent" aria-label="Add to Job">
            <option value="">Add to Job</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
