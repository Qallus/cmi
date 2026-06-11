"use client";

import * as React from "react";
import { CheckCircle2, Download, FileText, Image, Loader2, Package, Pencil, Plus, Share2, ShoppingCart, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Product, ProjectSelection, SelectionsData } from "@/lib/selections/types";

type ProductDraft = {
  id?: string;
  product_name: string;
  category: string;
  product_type: string;
  brand: string;
  manufacturer: string;
  sku: string;
  model_number: string;
  vendor_name: string;
  description: string;
  image_url: string;
  gallery_urls: string;
  video_url: string;
  spec_sheet_url: string;
  product_url: string;
  unit_cost: string;
  retail_price: string;
  markup_percent: string;
  lead_time_days: string;
  availability_status: string;
  warranty_info: string;
  install_notes: string;
  internal_notes: string;
};

type SelectionDraft = {
  id?: string;
  project_id: string;
  project_name: string;
  client_id: string;
  client_name: string;
  room_area_name: string;
  category: string;
  name: string;
  product_id: string;
  custom_product_name: string;
  description: string;
  image_url: string;
  gallery_urls: string;
  video_url: string;
  spec_sheet_url: string;
  product_url: string;
  vendor_id: string;
  vendor_name: string;
  subcontractor_id: string;
  subcontractor_name: string;
  designer_user_id: string;
  designer_name: string;
  related_task_id: string;
  selection_status: string;
  approval_status: string;
  procurement_status: string;
  install_status: string;
  client_visible: boolean;
  client_approval_required: boolean;
  quantity: string;
  unit: string;
  allowance_amount: string;
  estimated_cost: string;
  actual_cost: string;
  client_price: string;
  lead_time_days: string;
  target_decision_date: string;
  target_order_date: string;
  target_delivery_date: string;
  target_install_date: string;
  client_comments: string;
  internal_notes: string;
};

type ShareDraft = {
  resource_type: "product" | "selection";
  resource_id: string;
  resource_label: string;
  channel: "email" | "sms" | "link";
  recipient_type: string;
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string;
  subject: string;
  message: string;
};

const categories = ["Cabinets", "Countertops", "Tile", "Flooring", "Appliances", "Plumbing Fixtures", "Lighting Fixtures", "Hardware", "Paint", "Doors", "Windows", "Trim / Millwork", "Roofing", "Exterior Finish", "Landscape", "Outdoor Living", "Bathroom Fixtures", "Kitchen Fixtures", "Specialty Materials", "Custom Fabrication", "Client-Provided Product", "Vendor-Provided Product", "Other"];
const roomAreas = ["Kitchen", "Primary Bathroom", "Guest Bathroom", "Powder Room", "Bedroom", "Living Room", "Dining Room", "Office", "Laundry Room", "Garage", "Casita", "Exterior", "Patio", "Backyard", "Front Yard", "Entry", "Mechanical Room", "Whole Home"];
const selectionStatuses = ["draft", "needs_review", "pending_client_approval", "client_approved", "rejected_needs_revision", "approved_internally", "ordered", "backordered", "delivered", "installed", "canceled", "replaced", "completed"];
const approvalStatuses = ["not_required", "pending", "approved", "rejected", "revision_requested", "approved_with_changes"];
const procurementStatuses = ["not_ordered", "quote_requested", "quote_received", "ready_to_order", "ordered", "backordered", "partially_delivered", "delivered", "canceled"];
const installStatuses = ["not_ready", "ready_for_install", "scheduled", "in_progress", "installed", "needs_correction", "completed"];
const availabilityStatuses = ["available", "limited", "out_of_stock", "discontinued", "special_order", "unknown"];

function emptyProductDraft(): ProductDraft {
  return {
    product_name: "",
    category: "",
    product_type: "",
    brand: "",
    manufacturer: "",
    sku: "",
    model_number: "",
    vendor_name: "",
    description: "",
    image_url: "",
    gallery_urls: "",
    video_url: "",
    spec_sheet_url: "",
    product_url: "",
    unit_cost: "",
    retail_price: "",
    markup_percent: "",
    lead_time_days: "",
    availability_status: "available",
    warranty_info: "",
    install_notes: "",
    internal_notes: ""
  };
}

function emptySelectionDraft(): SelectionDraft {
  return {
    project_id: "",
    project_name: "",
    client_id: "",
    client_name: "",
    room_area_name: "",
    category: "",
    name: "",
    product_id: "",
    custom_product_name: "",
    description: "",
    image_url: "",
    gallery_urls: "",
    video_url: "",
    spec_sheet_url: "",
    product_url: "",
    vendor_id: "",
    vendor_name: "",
    subcontractor_id: "",
    subcontractor_name: "",
    designer_user_id: "",
    designer_name: "",
    related_task_id: "",
    selection_status: "draft",
    approval_status: "not_required",
    procurement_status: "not_ordered",
    install_status: "not_ready",
    client_visible: false,
    client_approval_required: false,
    quantity: "1",
    unit: "each",
    allowance_amount: "",
    estimated_cost: "",
    actual_cost: "",
    client_price: "",
    lead_time_days: "",
    target_decision_date: "",
    target_order_date: "",
    target_delivery_date: "",
    target_install_date: "",
    client_comments: "",
    internal_notes: ""
  };
}

export function SelectionsClient({ initialData, demoMode = false, setupMessage }: { initialData: SelectionsData; demoMode?: boolean; setupMessage?: string }) {
  const [products, setProducts] = React.useState(initialData.products);
  const [selections, setSelections] = React.useState(initialData.selections);
  const [productDraft, setProductDraft] = React.useState<ProductDraft | null>(null);
  const [selectionDraft, setSelectionDraft] = React.useState<SelectionDraft | null>(null);
  const [shareDraft, setShareDraft] = React.useState<ShareDraft | null>(null);
  const [view, setView] = React.useState<"selections" | "catalog">("selections");
  const [projectFilter, setProjectFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(setupMessage || null);

  const visibleSelections = React.useMemo(() => {
    return selections.filter(selection => {
      if (projectFilter && selection.project_name !== projectFilter && selection.project_id !== projectFilter) return false;
      if (statusFilter && selection.selection_status !== statusFilter && selection.approval_status !== statusFilter && selection.procurement_status !== statusFilter && selection.install_status !== statusFilter) return false;
      return true;
    });
  }, [projectFilter, selections, statusFilter]);

  const metrics = React.useMemo(() => {
    const pendingApproval = selections.filter(row => row.approval_status === "pending" || row.selection_status === "pending_client_approval").length;
    const approved = selections.filter(row => row.approval_status === "approved" || row.selection_status === "client_approved").length;
    const overBudget = selections.filter(row => Number(row.over_under_amount || 0) > 0 || (Number(row.actual_cost || 0) && Number(row.allowance_amount || 0) && Number(row.actual_cost || 0) > Number(row.allowance_amount || 0))).length;
    const ordered = selections.filter(row => row.procurement_status === "ordered").length;
    const delivered = selections.filter(row => row.procurement_status === "delivered" || row.selection_status === "delivered").length;
    const installed = selections.filter(row => row.install_status === "installed" || row.selection_status === "installed").length;
    return { pendingApproval, approved, overBudget, ordered, delivered, installed };
  }, [selections]);

  async function refresh() {
    if (demoMode) return;
    const [productRes, selectionRes] = await Promise.all([fetch("/api/admin/products"), fetch("/api/admin/selections")]);
    const productJson = await productRes.json();
    const selectionJson = await selectionRes.json();
    if (!productRes.ok) throw new Error(productJson.message || "Products refresh failed.");
    if (!selectionRes.ok) throw new Error(selectionJson.message || "Selections refresh failed.");
    setProducts(productJson.products || []);
    setSelections(selectionJson.selections || []);
  }

  async function saveProduct(draft: ProductDraft) {
    if (demoMode) {
      const product = draftToProduct(draft);
      setProducts(current => draft.id ? current.map(row => row.id === draft.id ? product : row) : [product, ...current]);
      setProductDraft(null);
      setNotice("Demo product saved locally.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(draft.id ? `/api/admin/products/${draft.id}` : "/api/admin/products", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Product save failed.");
      await refresh();
      setProductDraft(null);
      setNotice("Product saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Product save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelection(draft: SelectionDraft) {
    const selectedProduct = products.find(product => product.id === draft.product_id);
    const payload = selectedProduct ? {
      ...draft,
      name: draft.name || selectedProduct.product_name,
      custom_product_name: draft.custom_product_name || selectedProduct.product_name,
      category: draft.category || selectedProduct.category || "",
      vendor_id: draft.vendor_id || selectedProduct.vendor_id || "",
      vendor_name: draft.vendor_name || selectedProduct.vendor_name || "",
      image_url: draft.image_url || selectedProduct.image_url || "",
      gallery_urls: draft.gallery_urls || (selectedProduct.gallery_urls || []).join("\n"),
      video_url: draft.video_url || selectedProduct.video_url || "",
      spec_sheet_url: draft.spec_sheet_url || selectedProduct.spec_sheet_url || "",
      product_url: draft.product_url || selectedProduct.product_url || "",
      lead_time_days: draft.lead_time_days || String(selectedProduct.lead_time_days || ""),
      estimated_cost: draft.estimated_cost || String(selectedProduct.retail_price || "")
    } : draft;

    if (demoMode) {
      const selection = draftToSelection(payload);
      setSelections(current => draft.id ? current.map(row => row.id === draft.id ? selection : row) : [selection, ...current]);
      setSelectionDraft(null);
      setNotice("Demo selection saved locally.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(draft.id ? `/api/admin/selections/${draft.id}` : "/api/admin/selections", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Selection save failed.");
      await refresh();
      setSelectionDraft(null);
      setNotice("Selection saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Selection save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function importCsv(kind: "product" | "selection", file: File | null) {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      setNotice("No rows found in CSV.");
      return;
    }
    setSaving(true);
    let imported = 0;
    try {
      for (const row of rows) {
        const res = await fetch(kind === "product" ? "/api/admin/products" : "/api/admin/selections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row)
        });
        if (res.ok) imported += 1;
      }
      await refresh();
      setNotice(`Imported ${imported} ${kind === "product" ? "products" : "selections"} from CSV.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "CSV import failed.");
    } finally {
      setSaving(false);
    }
  }

  async function shareResource(draft: ShareDraft) {
    const shareUrl = `${window.location.origin}/dashboard/selections?share=${draft.resource_type}-${draft.resource_id}`;
    if (draft.channel === "link") {
      await navigator.clipboard?.writeText(shareUrl);
      setShareDraft(null);
      setNotice("Share link copied.");
      return;
    }
    if (demoMode) {
      setShareDraft(null);
      setNotice(`Demo ${draft.channel.toUpperCase()} share queued locally.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/selections/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, share_url: shareUrl })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Share failed.");
      setShareDraft(null);
      setNotice(`${draft.channel.toUpperCase()} share queued.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Share failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent">Product Selections</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Selections</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Manage project products, rooms, vendors, approvals, procurement, install status, allowances, and related schedule tasks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" />
            Product CSV
            <input className="hidden" type="file" accept=".csv,text/csv" onChange={event => importCsv("product", event.target.files?.[0] || null)} />
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" />
            Selection CSV
            <input className="hidden" type="file" accept=".csv,text/csv" onChange={event => importCsv("selection", event.target.files?.[0] || null)} />
          </label>
          <Button variant="outline" onClick={() => exportCsv(view === "catalog" ? "products" : "selections", view === "catalog" ? products : visibleSelections)}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => printPdf(view === "catalog" ? "Product Catalog" : "Project Selections", view === "catalog" ? products : visibleSelections)}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => setProductDraft(emptyProductDraft())}><Package className="h-4 w-4" /> Add Product</Button>
          <Button variant="accent" onClick={() => setSelectionDraft(emptySelectionDraft())}><Plus className="h-4 w-4" /> Add Selection</Button>
        </div>
      </header>

      {notice ? <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total Selections" value={String(selections.length)} sub={`${products.length} catalog products`} />
        <MetricCard label="Pending Approval" value={String(metrics.pendingApproval)} sub="Client action needed" tone="warning" />
        <MetricCard label="Approved" value={String(metrics.approved)} sub="Client or internal" tone="success" />
        <MetricCard label="Over Budget" value={String(metrics.overBudget)} sub="Allowance review" tone="danger" />
        <MetricCard label="Ordered" value={String(metrics.ordered)} sub="Procurement active" />
        <MetricCard label="Installed" value={String(metrics.installed)} sub={`${metrics.delivered} delivered`} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex w-fit rounded-md border border-border bg-muted p-1">
              <button type="button" className={tabClass(view === "selections")} onClick={() => setView("selections")}>Selections</button>
              <button type="button" className={tabClass(view === "catalog")} onClick={() => setView("catalog")}>Product Catalog</button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Select value={projectFilter} onChange={event => setProjectFilter(event.target.value)}>
                <option value="">All projects</option>
                {Array.from(new Set(selections.map(selection => selection.project_name || selection.project_id || "").filter(Boolean))).sort().map(project => <option key={project} value={project}>{project}</option>)}
              </Select>
              <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {[...selectionStatuses, ...approvalStatuses, ...procurementStatuses, ...installStatuses].map(status => <option key={status} value={status}>{label(status)}</option>)}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {view === "selections" ? (
            <SelectionTable selections={visibleSelections} onEdit={selection => setSelectionDraft(selectionToDraft(selection))} onShare={selection => setShareDraft(makeShareDraft("selection", selection.id, selection.name))} onCsv={selection => exportCsv("selection", [selection])} onPdf={selection => printPdf(`Selection - ${selection.name}`, [selection])} />
          ) : (
            <ProductCatalog products={products} onEdit={product => setProductDraft(productToDraft(product))} onShare={product => setShareDraft(makeShareDraft("product", product.id, product.product_name))} onCsv={product => exportCsv("product", [product])} onPdf={product => printPdf(`Product - ${product.product_name}`, [product])} onAddSelection={product => setSelectionDraft({ ...emptySelectionDraft(), product_id: product.id, name: product.product_name, custom_product_name: product.product_name, category: product.category || "", vendor_id: product.vendor_id || "", vendor_name: product.vendor_name || "", image_url: product.image_url || "", gallery_urls: (product.gallery_urls || []).join("\n"), video_url: product.video_url || "", spec_sheet_url: product.spec_sheet_url || "", product_url: product.product_url || "", estimated_cost: String(product.retail_price || ""), lead_time_days: String(product.lead_time_days || "") })} />
          )}
        </CardContent>
      </Card>

      {productDraft ? <ProductModal draft={productDraft} saving={saving} onChange={setProductDraft} onClose={() => setProductDraft(null)} onSave={saveProduct} /> : null}
      {selectionDraft ? <SelectionModal data={initialData} products={products} draft={selectionDraft} saving={saving} onChange={setSelectionDraft} onClose={() => setSelectionDraft(null)} onSave={saveSelection} /> : null}
      {shareDraft ? <ShareModal draft={shareDraft} saving={saving} onChange={setShareDraft} onClose={() => setShareDraft(null)} onShare={shareResource} /> : null}
    </div>
  );
}

function MetricCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub: string; tone?: "default" | "success" | "warning" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className={cn("mt-3 text-2xl font-semibold", tone === "success" && "text-success", tone === "warning" && "text-warning", tone === "danger" && "text-destructive")}>{value}</div>
        <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function SelectionTable({
  selections,
  onEdit,
  onShare,
  onCsv,
  onPdf
}: {
  selections: ProjectSelection[];
  onEdit: (selection: ProjectSelection) => void;
  onShare: (selection: ProjectSelection) => void;
  onCsv: (selection: ProjectSelection) => void;
  onPdf: (selection: ProjectSelection) => void;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="border-b border-border bg-muted text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Selection</th>
            <th className="px-4 py-3 font-medium">Project / Room</th>
            <th className="px-4 py-3 font-medium">Vendor</th>
            <th className="px-4 py-3 font-medium">Approval</th>
            <th className="px-4 py-3 font-medium">Procurement</th>
            <th className="px-4 py-3 font-medium">Install</th>
            <th className="px-4 py-3 font-medium">Budget</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {selections.map(selection => (
            <tr key={selection.id} className="hover:bg-muted/50">
              <td className="px-4 py-3">
                <div className="font-medium">{selection.name}</div>
                <div className="text-xs text-muted-foreground">{selection.category || "Uncategorized"} / {selection.custom_product_name || "Custom product"}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <div>{selection.project_name || "Project name needed"}</div>
                <div className="text-xs">{selection.room_area_name || "No room/area"} {selection.related_task_id ? "/ linked task" : ""}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{selection.vendor_name || "No vendor"}</td>
              <td className="px-4 py-3"><StatusBadge value={selection.approval_status} /></td>
              <td className="px-4 py-3"><StatusBadge value={selection.procurement_status} /></td>
              <td className="px-4 py-3"><StatusBadge value={selection.install_status} /></td>
              <td className="px-4 py-3 text-muted-foreground">
                <div>{money(selection.client_price || selection.estimated_cost || selection.actual_cost)}</div>
                {selection.allowance_amount ? <div className="text-xs">Allowance {money(selection.allowance_amount)}</div> : null}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => onEdit(selection)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => onShare(selection)}><Share2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => onCsv(selection)}><Download className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => onPdf(selection)}><FileText className="h-3.5 w-3.5" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!selections.length ? <div className="p-8 text-center text-sm text-muted-foreground">No selections match the current filters.</div> : null}
    </div>
  );
}

function ProductCatalog({
  products,
  onEdit,
  onShare,
  onCsv,
  onPdf,
  onAddSelection
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onShare: (product: Product) => void;
  onCsv: (product: Product) => void;
  onPdf: (product: Product) => void;
  onAddSelection: (product: Product) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {products.map(product => (
        <div key={product.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
              {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <Image className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{product.product_name}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{product.category || "Uncategorized"} / {product.vendor_name || "No vendor"}</div>
              <div className="mt-3 flex flex-wrap gap-1">
                <StatusBadge value={product.availability_status} />
                {product.retail_price ? <Badge>{money(product.retail_price)}</Badge> : null}
                {product.lead_time_days ? <Badge>{product.lead_time_days} days</Badge> : null}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(product)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            <Button size="sm" variant="accent" onClick={() => onAddSelection(product)}><ShoppingCart className="h-3.5 w-3.5" /> Add to Project</Button>
            <Button size="sm" variant="ghost" onClick={() => onShare(product)}><Share2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onCsv(product)}><Download className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onPdf(product)}><FileText className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ))}
      {!products.length ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No catalog products yet.</div> : null}
    </div>
  );
}

function ProductModal({ draft, saving, onChange, onClose, onSave }: { draft: ProductDraft; saving: boolean; onChange: (draft: ProductDraft) => void; onClose: () => void; onSave: (draft: ProductDraft) => void }) {
  const update = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => onChange({ ...draft, [key]: value });
  const [showUrlFields, setShowUrlFields] = React.useState(false);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const upload = async (field: "image_url" | "gallery_urls" | "video_url", file: File | null) => {
    if (!file) return;
    setUploading(field);
    setUploadError(null);
    try {
      const url = await uploadMedia(file, "products");
      if (field === "gallery_urls") {
        update(field, [draft.gallery_urls, url].filter(Boolean).join("\n"));
      } else {
        update(field, url);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-sm">
      <div className="ml-auto flex h-full max-w-4xl flex-col rounded-lg border border-border bg-card shadow-lg">
        <ModalHeader eyebrow="Product Catalog" title={draft.id ? "Edit Product" : "Add Product"} onClose={onClose} />
        <div className="flex-1 space-y-4 overflow-auto p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Product Name"><Input value={draft.product_name} onChange={event => update("product_name", event.target.value)} /></Field>
            <Field label="Vendor"><Input value={draft.vendor_name} onChange={event => update("vendor_name", event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Category"><OptionSelect value={draft.category} options={categories} placeholder="Category" onChange={value => update("category", value)} /></Field>
            <Field label="Type"><Input value={draft.product_type} onChange={event => update("product_type", event.target.value)} /></Field>
            <Field label="Brand"><Input value={draft.brand} onChange={event => update("brand", event.target.value)} /></Field>
            <Field label="Manufacturer"><Input value={draft.manufacturer} onChange={event => update("manufacturer", event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="SKU"><Input value={draft.sku} onChange={event => update("sku", event.target.value)} /></Field>
            <Field label="Model Number"><Input value={draft.model_number} onChange={event => update("model_number", event.target.value)} /></Field>
            <Field label="Availability"><OptionSelect value={draft.availability_status} options={availabilityStatuses} onChange={value => update("availability_status", value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Unit Cost"><Input type="number" min={0} step={0.01} value={draft.unit_cost} onChange={event => update("unit_cost", event.target.value)} /></Field>
            <Field label="Retail Price"><Input type="number" min={0} step={0.01} value={draft.retail_price} onChange={event => update("retail_price", event.target.value)} /></Field>
            <Field label="Markup %"><Input type="number" min={0} step={0.01} value={draft.markup_percent} onChange={event => update("markup_percent", event.target.value)} /></Field>
            <Field label="Lead Time Days"><Input type="number" min={0} value={draft.lead_time_days} onChange={event => update("lead_time_days", event.target.value)} /></Field>
          </div>
          <MediaUploadPanel
            imageUrl={draft.image_url}
            galleryUrls={draft.gallery_urls}
            videoUrl={draft.video_url}
            uploading={uploading}
            onUpload={upload}
          />
          {uploadError ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{uploadError}</div> : null}
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showUrlFields} onChange={event => setShowUrlFields(event.target.checked)} />
            Use URLs instead of upload
          </label>
          {showUrlFields ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Featured Image URL"><Input value={draft.image_url} onChange={event => update("image_url", event.target.value)} /></Field>
                <Field label="Video URL"><Input value={draft.video_url} onChange={event => update("video_url", event.target.value)} /></Field>
                <Field label="Spec Sheet URL"><Input value={draft.spec_sheet_url} onChange={event => update("spec_sheet_url", event.target.value)} /></Field>
                <Field label="Product URL"><Input value={draft.product_url} onChange={event => update("product_url", event.target.value)} /></Field>
              </div>
              <Field label="Gallery URLs">
                <Textarea value={draft.gallery_urls} onChange={event => update("gallery_urls", event.target.value)} placeholder="One image URL per line, or comma-separated URLs." />
              </Field>
            </>
          ) : null}
          <Field label="Description"><Textarea value={draft.description} onChange={event => update("description", event.target.value)} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Warranty Info"><Textarea value={draft.warranty_info} onChange={event => update("warranty_info", event.target.value)} /></Field>
            <Field label="Install Notes"><Textarea value={draft.install_notes} onChange={event => update("install_notes", event.target.value)} /></Field>
          </div>
          <Field label="Internal Notes"><Textarea value={draft.internal_notes} onChange={event => update("internal_notes", event.target.value)} /></Field>
        </div>
        <ModalFooter saving={saving} saveLabel="Save Product" onClose={onClose} onSave={() => onSave(draft)} />
      </div>
    </div>
  );
}

function SelectionModal({ data, products, draft, saving, onChange, onClose, onSave }: { data: SelectionsData; products: Product[]; draft: SelectionDraft; saving: boolean; onChange: (draft: SelectionDraft) => void; onClose: () => void; onSave: (draft: SelectionDraft) => void }) {
  const update = <K extends keyof SelectionDraft>(key: K, value: SelectionDraft[K]) => onChange({ ...draft, [key]: value });
  const selectedProduct = products.find(product => product.id === draft.product_id);
  const [showUrlFields, setShowUrlFields] = React.useState(false);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const upload = async (field: "image_url" | "gallery_urls" | "video_url", file: File | null) => {
    if (!file) return;
    setUploading(field);
    setUploadError(null);
    try {
      const url = await uploadMedia(file, "selections");
      if (field === "gallery_urls") {
        update(field, [draft.gallery_urls, url].filter(Boolean).join("\n"));
      } else {
        update(field, url);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-sm">
      <div className="ml-auto flex h-full max-w-5xl flex-col rounded-lg border border-border bg-card shadow-lg">
        <ModalHeader eyebrow="Project Selection" title={draft.id ? "Edit Selection" : "Add Selection"} onClose={onClose} />
        <div className="flex-1 space-y-4 overflow-auto p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Project">
              <Select value={draft.project_id} onChange={event => {
                const project = data.projects.find(option => option.id === event.target.value);
                onChange({ ...draft, project_id: event.target.value, project_name: project?.label || draft.project_name });
              }}>
                <option value="">Select project</option>
                {data.projects.map(project => <option key={project.id} value={project.id}>{project.label}</option>)}
              </Select>
            </Field>
            <Field label="Project Name"><Input value={draft.project_name} onChange={event => update("project_name", event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Selection Name"><Input value={draft.name} onChange={event => update("name", event.target.value)} /></Field>
            <Field label="Room / Area"><OptionSelect value={draft.room_area_name} options={roomAreas} placeholder="Room / Area" onChange={value => update("room_area_name", value)} /></Field>
            <Field label="Category"><OptionSelect value={draft.category} options={categories} placeholder="Category" onChange={value => update("category", value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Catalog Product">
              <Select value={draft.product_id} onChange={event => {
                const product = products.find(row => row.id === event.target.value);
                onChange({
                  ...draft,
                  product_id: event.target.value,
                  name: product?.product_name || draft.name,
                  custom_product_name: product?.product_name || draft.custom_product_name,
                  category: product?.category || draft.category,
                  vendor_id: product?.vendor_id || draft.vendor_id,
                  vendor_name: product?.vendor_name || draft.vendor_name,
                  image_url: product?.image_url || draft.image_url,
                  spec_sheet_url: product?.spec_sheet_url || draft.spec_sheet_url,
                  product_url: product?.product_url || draft.product_url,
                  estimated_cost: product?.retail_price ? String(product.retail_price) : draft.estimated_cost,
                  lead_time_days: product?.lead_time_days ? String(product.lead_time_days) : draft.lead_time_days
                });
              }}>
                <option value="">Custom / no catalog product</option>
                {products.map(product => <option key={product.id} value={product.id}>{product.product_name}</option>)}
              </Select>
            </Field>
            <Field label="Custom Product Name"><Input value={draft.custom_product_name} onChange={event => update("custom_product_name", event.target.value)} placeholder={selectedProduct?.product_name || "One-off product name"} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Client">
              <Select value={draft.client_id} onChange={event => {
                const client = data.contacts.find(option => option.id === event.target.value);
                onChange({ ...draft, client_id: event.target.value, client_name: client?.label || "" });
              }}>
                <option value="">No client selected</option>
                {data.contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.label}</option>)}
              </Select>
            </Field>
            <Field label="Vendor"><Input value={draft.vendor_name} onChange={event => update("vendor_name", event.target.value)} /></Field>
            <Field label="Subcontractor">
              <Select value={draft.subcontractor_id} onChange={event => {
                const subcontractor = data.subcontractors.find(option => option.id === event.target.value);
                onChange({ ...draft, subcontractor_id: event.target.value, subcontractor_name: subcontractor?.label || "" });
              }}>
                <option value="">No subcontractor</option>
                {data.subcontractors.map(contact => <option key={contact.id} value={contact.id}>{contact.label}</option>)}
              </Select>
            </Field>
            <Field label="Designer">
              <Select value={draft.designer_user_id} onChange={event => {
                const designer = data.staffUsers.find(option => option.id === event.target.value);
                onChange({ ...draft, designer_user_id: event.target.value, designer_name: designer?.label || "" });
              }}>
                <option value="">No designer</option>
                {data.staffUsers.map(user => <option key={user.id} value={user.id}>{user.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Related Project Task">
            <Select value={draft.related_task_id} onChange={event => update("related_task_id", event.target.value)}>
              <option value="">No linked task</option>
              {data.tasks.map(task => <option key={task.id} value={task.id}>{task.label} {task.sublabel ? `- ${task.sublabel}` : ""}</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Selection Status"><OptionSelect value={draft.selection_status} options={selectionStatuses} onChange={value => update("selection_status", value)} /></Field>
            <Field label="Approval Status"><OptionSelect value={draft.approval_status} options={approvalStatuses} onChange={value => update("approval_status", value)} /></Field>
            <Field label="Procurement Status"><OptionSelect value={draft.procurement_status} options={procurementStatuses} onChange={value => update("procurement_status", value)} /></Field>
            <Field label="Install Status"><OptionSelect value={draft.install_status} options={installStatuses} onChange={value => update("install_status", value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Quantity"><Input type="number" min={0} step={0.01} value={draft.quantity} onChange={event => update("quantity", event.target.value)} /></Field>
            <Field label="Unit"><Input value={draft.unit} onChange={event => update("unit", event.target.value)} /></Field>
            <Field label="Allowance"><Input type="number" min={0} step={0.01} value={draft.allowance_amount} onChange={event => update("allowance_amount", event.target.value)} /></Field>
            <Field label="Estimated Cost"><Input type="number" min={0} step={0.01} value={draft.estimated_cost} onChange={event => update("estimated_cost", event.target.value)} /></Field>
            <Field label="Actual Cost"><Input type="number" min={0} step={0.01} value={draft.actual_cost} onChange={event => update("actual_cost", event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Client Price"><Input type="number" min={0} step={0.01} value={draft.client_price} onChange={event => update("client_price", event.target.value)} /></Field>
            <Field label="Lead Days"><Input type="number" min={0} value={draft.lead_time_days} onChange={event => update("lead_time_days", event.target.value)} /></Field>
            <Field label="Decision Date"><Input type="date" value={draft.target_decision_date} onChange={event => update("target_decision_date", event.target.value)} /></Field>
            <Field label="Order Date"><Input type="date" value={draft.target_order_date} onChange={event => update("target_order_date", event.target.value)} /></Field>
            <Field label="Delivery Date"><Input type="date" value={draft.target_delivery_date} onChange={event => update("target_delivery_date", event.target.value)} /></Field>
          </div>
          <Field label="Target Install Date"><Input type="date" value={draft.target_install_date} onChange={event => update("target_install_date", event.target.value)} /></Field>
          <MediaUploadPanel
            imageUrl={draft.image_url}
            galleryUrls={draft.gallery_urls}
            videoUrl={draft.video_url}
            uploading={uploading}
            onUpload={upload}
          />
          {uploadError ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{uploadError}</div> : null}
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showUrlFields} onChange={event => setShowUrlFields(event.target.checked)} />
            Use URLs instead of upload
          </label>
          {showUrlFields ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Featured Image URL"><Input value={draft.image_url} onChange={event => update("image_url", event.target.value)} /></Field>
                <Field label="Video URL"><Input value={draft.video_url} onChange={event => update("video_url", event.target.value)} /></Field>
                <Field label="Spec Sheet URL"><Input value={draft.spec_sheet_url} onChange={event => update("spec_sheet_url", event.target.value)} /></Field>
                <Field label="Product URL"><Input value={draft.product_url} onChange={event => update("product_url", event.target.value)} /></Field>
              </div>
              <Field label="Gallery URLs">
                <Textarea value={draft.gallery_urls} onChange={event => update("gallery_urls", event.target.value)} placeholder="One image URL per line, or comma-separated URLs." />
              </Field>
            </>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={draft.client_visible} onChange={event => update("client_visible", event.target.checked)} />
              Client visible
            </label>
            <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={draft.client_approval_required} onChange={event => update("client_approval_required", event.target.checked)} />
              Approval required
            </label>
          </div>
          <Field label="Description"><Textarea value={draft.description} onChange={event => update("description", event.target.value)} /></Field>
          <Field label="Client Comments"><Textarea value={draft.client_comments} onChange={event => update("client_comments", event.target.value)} /></Field>
          <Field label="Internal Notes"><Textarea value={draft.internal_notes} onChange={event => update("internal_notes", event.target.value)} /></Field>
        </div>
        <ModalFooter saving={saving} saveLabel="Save Selection" onClose={onClose} onSave={() => onSave(draft)} />
      </div>
    </div>
  );
}

function ModalHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border p-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</div>
        <h2 className="mt-2 font-display text-2xl font-semibold">{title}</h2>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
    </div>
  );
}

function ModalFooter({ saving, saveLabel, onClose, onSave }: { saving: boolean; saveLabel: string; onClose: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border p-4">
      <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      <Button type="button" variant="accent" disabled={saving} onClick={onSave}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {saveLabel}
      </Button>
    </div>
  );
}

function ShareModal({ draft, saving, onChange, onClose, onShare }: { draft: ShareDraft; saving: boolean; onChange: (draft: ShareDraft) => void; onClose: () => void; onShare: (draft: ShareDraft) => void }) {
  const update = <K extends keyof ShareDraft>(key: K, value: ShareDraft[K]) => onChange({ ...draft, [key]: value });
  return (
    <div className="fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-sm">
      <div className="ml-auto flex h-full max-w-xl flex-col rounded-lg border border-border bg-card shadow-lg">
        <ModalHeader eyebrow="Share" title={`Share ${draft.resource_label}`} onClose={onClose} />
        <div className="flex-1 space-y-4 overflow-auto p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Channel">
              <Select value={draft.channel} onChange={event => update("channel", event.target.value as ShareDraft["channel"])}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="link">Copy Link</option>
              </Select>
            </Field>
            <Field label="Recipient Type">
              <Select value={draft.recipient_type} onChange={event => update("recipient_type", event.target.value)}>
                <option value="client">Client</option>
                <option value="vendor">Vendor</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="staff">Staff</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>
          <Field label="Recipient Name"><Input value={draft.recipient_name} onChange={event => update("recipient_name", event.target.value)} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Email"><Input value={draft.recipient_email} onChange={event => update("recipient_email", event.target.value)} /></Field>
            <Field label="Phone"><Input value={draft.recipient_phone} onChange={event => update("recipient_phone", event.target.value)} /></Field>
          </div>
          <Field label="Subject"><Input value={draft.subject} onChange={event => update("subject", event.target.value)} /></Field>
          <Field label="Message"><Textarea value={draft.message} onChange={event => update("message", event.target.value)} /></Field>
        </div>
        <ModalFooter saving={saving} saveLabel={draft.channel === "link" ? "Copy Link" : "Queue Share"} onClose={onClose} onSave={() => onShare(draft)} />
      </div>
    </div>
  );
}

async function uploadMedia(file: File, folder: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const response = await fetch("/api/admin/uploads", {
    method: "POST",
    body: form
  });
  const json = await response.json().catch(() => ({ message: "Upload failed." }));
  if (!response.ok) throw new Error(json.message || "Upload failed.");
  return String(json.url || "");
}

function MediaUploadPanel({
  imageUrl,
  galleryUrls,
  videoUrl,
  uploading,
  onUpload
}: {
  imageUrl: string;
  galleryUrls: string;
  videoUrl: string;
  uploading: string | null;
  onUpload: (field: "image_url" | "gallery_urls" | "video_url", file: File | null) => void;
}) {
  const galleryCount = parseUrlList(galleryUrls).length;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Media uploads</div>
          <div className="text-xs text-muted-foreground">Upload first. URL fields are available below as an alternate path.</div>
        </div>
        <Badge>{galleryCount} gallery</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <UploadBox
          label="Featured image"
          accept="image/*"
          icon={<Image className="h-5 w-5" />}
          previewUrl={imageUrl}
          uploading={uploading === "image_url"}
          onFile={file => onUpload("image_url", file)}
        />
        <UploadBox
          label="Gallery images"
          accept="image/*"
          multiple
          icon={<Upload className="h-5 w-5" />}
          note={galleryCount ? `${galleryCount} image URL${galleryCount === 1 ? "" : "s"} attached` : "Add one or more gallery images"}
          uploading={uploading === "gallery_urls"}
          onFile={file => onUpload("gallery_urls", file)}
        />
        <UploadBox
          label="Video"
          accept="video/*"
          icon={<FileText className="h-5 w-5" />}
          note={videoUrl ? "Video attached" : "Upload a product or selection video"}
          uploading={uploading === "video_url"}
          onFile={file => onUpload("video_url", file)}
        />
      </div>
    </div>
  );
}

function UploadBox({
  label,
  accept,
  icon,
  note,
  previewUrl,
  multiple,
  uploading,
  onFile
}: {
  label: string;
  accept: string;
  icon: React.ReactNode;
  note?: string;
  previewUrl?: string;
  multiple?: boolean;
  uploading?: boolean;
  onFile: (file: File | null) => void;
}) {
  return (
    <label className="group flex min-h-36 cursor-pointer flex-col justify-between rounded-lg border border-dashed border-border bg-background p-3 transition hover:border-accent hover:bg-accent/5 dark:bg-card">
      <input
        className="hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={event => {
          const files = Array.from(event.target.files || []);
          files.forEach(file => onFile(file));
          event.currentTarget.value = "";
        }}
      />
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}</span>
        {label}
      </div>
      {previewUrl ? (
        <img src={previewUrl} alt="" className="mt-3 h-20 w-full rounded-md object-cover" />
      ) : (
        <div className="mt-3 rounded-md bg-muted/70 p-3 text-xs text-muted-foreground">{note || "Choose a file from your computer."}</div>
      )}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function OptionSelect({ value, options, placeholder, onChange }: { value: string; options: string[]; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onChange={event => onChange(event.target.value)}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map(option => <option key={option} value={option}>{label(option)}</option>)}
    </Select>
  );
}

function StatusBadge({ value }: { value: string | null }) {
  const clean = value || "unknown";
  const tone = clean.includes("approved") || clean.includes("delivered") || clean.includes("installed") || clean === "available" ? "success"
    : clean.includes("pending") || clean.includes("review") || clean.includes("ordered") || clean.includes("limited") ? "warning"
      : clean.includes("rejected") || clean.includes("backordered") || clean.includes("out_of_stock") || clean.includes("canceled") ? "danger"
        : "default";
  return <Badge tone={tone}>{label(clean)}</Badge>;
}

function tabClass(active: boolean) {
  return cn("inline-flex h-8 items-center rounded px-3 text-xs font-medium transition", active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground");
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
}

function parseUrlList(value: string) {
  return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
}

function makeShareDraft(resourceType: "product" | "selection", resourceId: string, resourceLabel: string): ShareDraft {
  return {
    resource_type: resourceType,
    resource_id: resourceId,
    resource_label: resourceLabel,
    channel: "email",
    recipient_type: "client",
    recipient_name: "",
    recipient_email: "",
    recipient_phone: "",
    subject: `Constructed Matter ${resourceType}: ${resourceLabel}`,
    message: `Hi, here is the ${resourceType} information for review: ${resourceLabel}.`
  };
}

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(header => header.trim());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(value => value.trim());
}

function exportCsv(label: string, rows: Array<Record<string, unknown>>) {
  const normalized = rows.map(row => flattenExportRow(row));
  const headers = Array.from(new Set(normalized.flatMap(row => Object.keys(row))));
  const csv = [
    ["Constructed Matter, Inc.", label],
    [`Exported ${new Date().toLocaleString()}`],
    [],
    headers,
    ...normalized.map(row => headers.map(header => row[header] ?? ""))
  ].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `cmi-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function printPdf(title: string, rows: Array<Record<string, unknown>>) {
  const logoUrl = `${window.location.origin}/brand/cmi-logo-light.png`;
  const sheets = rows.map(row => selectionSheet(row)).join("");
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #171513; margin: 0; background: #f7f4ef; }
          .sheet { min-height: 100vh; padding: 40px; page-break-after: always; }
          .paper { background: #fff; border: 1px solid #ded7ce; border-radius: 18px; overflow: hidden; }
          header { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 28px 32px; border-bottom: 1px solid #e7e0d8; }
          header img { height: 42px; width: auto; }
          .eyebrow { color: #a87328; font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
          h1 { font-family: Georgia, serif; font-size: 34px; margin: 8px 0 0; line-height: 1.05; }
          .meta { color: #7a746d; font-size: 12px; text-align: right; }
          .hero { display: grid; grid-template-columns: 42% 1fr; gap: 28px; padding: 32px; }
          .hero-img { min-height: 260px; border-radius: 14px; background: #eee9e2; overflow: hidden; }
          .hero-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .placeholder { height: 100%; display: flex; align-items: center; justify-content: center; color: #8d867e; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          .summary { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .field { border: 1px solid #eee8df; border-radius: 12px; padding: 12px; min-height: 64px; }
          .field strong, .section-title { display: block; color: #a87328; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 6px; }
          .field span { font-size: 14px; font-weight: 600; }
          .wide { grid-column: 1 / -1; }
          .description { padding: 0 32px 32px; }
          .description-box { border-top: 1px solid #e7e0d8; padding-top: 24px; font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
          .gallery { display: flex; gap: 10px; padding: 0 32px 32px; }
          .gallery img { width: 104px; height: 72px; border-radius: 10px; object-fit: cover; border: 1px solid #eee8df; }
          @media print {
            body { background: #fff; }
            .sheet { padding: 0; }
            .paper { border: 0; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        ${sheets || `<div class="sheet"><div class="paper"><header><img src="${logoUrl}" alt="Constructed Matter, Inc." /><div><div class="eyebrow">Selection Sheet</div><h1>${escapeHtml(title)}</h1></div></header></div></div>`}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function selectionSheet(row: Record<string, unknown>) {
  const logoUrl = `${window.location.origin}/brand/cmi-logo-light.png`;
  const title = String(row.name || row.product_name || row.custom_product_name || "Selection");
  const imageUrl = String(row.image_url || row.featured_image || "");
  const gallery = Array.isArray(row.gallery_urls) ? row.gallery_urls.map(String).filter(Boolean) : parseUrlList(String(row.gallery_urls || ""));
  const description = String(row.description || row.install_notes || row.internal_notes || "No description has been added yet.");
  const fields = [
    ["Project", row.project_name || row.project_id || "Not linked"],
    ["Task / Area", row.room_area_name || row.related_task_id || row.project_schedule_item_id || "Not linked"],
    ["Vendor", row.vendor_name || "No vendor"],
    ["Category", row.category || row.product_type || "Uncategorized"],
    ["Price", money(Number(row.client_price || row.retail_price || row.estimated_cost || row.actual_cost || 0) || null)],
    ["Quantity", row.quantity ? `${row.quantity} ${row.unit || ""}` : "Not set"],
    ["Approval", row.approval_status || row.client_approval_status || "Not required"],
    ["Procurement", row.procurement_status || row.availability_status || "Not ordered"],
    ["Install", row.install_status || "Not ready"],
    ["Delivery", row.target_delivery_date || row.delivery_date || "Not scheduled"]
  ];

  return `
    <section class="sheet">
      <div class="paper">
        <header>
          <img src="${logoUrl}" alt="Constructed Matter, Inc." />
          <div class="meta">
            <div class="eyebrow">Selection Sheet</div>
            <div>${escapeHtml(new Date().toLocaleDateString())}</div>
          </div>
        </header>
        <div class="hero">
          <div class="hero-img">${imageUrl ? `<img src="${escapeAttr(imageUrl)}" alt="" />` : `<div class="placeholder">No image</div>`}</div>
          <div>
            <div class="eyebrow">Constructed Matter Selection</div>
            <h1>${escapeHtml(title)}</h1>
            <div class="summary" style="margin-top: 22px;">
              ${fields.map(([label, value]) => `<div class="field"><strong>${escapeHtml(String(label))}</strong><span>${escapeHtml(String(value || "-"))}</span></div>`).join("")}
            </div>
          </div>
        </div>
        <div class="description">
          <div class="section-title">Description</div>
          <div class="description-box">${escapeHtml(description)}</div>
        </div>
        ${gallery.length ? `<div class="gallery">${gallery.slice(0, 6).map(url => `<img src="${escapeAttr(url)}" alt="" />`).join("")}</div>` : ""}
      </div>
    </section>
  `;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function flattenExportRow(row: Record<string, unknown>) {
  const output: Record<string, string | number | boolean> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (value == null || typeof value === "object") return;
    output[key] = value as string | number | boolean;
  });
  return output;
}

function productToDraft(product: Product): ProductDraft {
  return {
    id: product.id,
    product_name: product.product_name,
    category: product.category || "",
    product_type: product.product_type || "",
    brand: product.brand || "",
    manufacturer: product.manufacturer || "",
    sku: product.sku || "",
    model_number: product.model_number || "",
    vendor_name: product.vendor_name || "",
    description: product.description || "",
    image_url: product.image_url || "",
    gallery_urls: (product.gallery_urls || []).join("\n"),
    video_url: product.video_url || "",
    spec_sheet_url: product.spec_sheet_url || "",
    product_url: product.product_url || "",
    unit_cost: product.unit_cost == null ? "" : String(product.unit_cost),
    retail_price: product.retail_price == null ? "" : String(product.retail_price),
    markup_percent: product.markup_percent == null ? "" : String(product.markup_percent),
    lead_time_days: product.lead_time_days == null ? "" : String(product.lead_time_days),
    availability_status: product.availability_status || "available",
    warranty_info: product.warranty_info || "",
    install_notes: product.install_notes || "",
    internal_notes: product.internal_notes || ""
  };
}

function selectionToDraft(selection: ProjectSelection): SelectionDraft {
  return {
    id: selection.id,
    project_id: selection.project_id || "",
    project_name: selection.project_name || "",
    client_id: selection.client_id || "",
    client_name: selection.client_name || "",
    room_area_name: selection.room_area_name || "",
    category: selection.category || "",
    name: selection.name,
    product_id: selection.product_id || "",
    custom_product_name: selection.custom_product_name || "",
    description: selection.description || "",
    image_url: selection.image_url || "",
    gallery_urls: (selection.gallery_urls || []).join("\n"),
    video_url: selection.video_url || "",
    spec_sheet_url: selection.spec_sheet_url || "",
    product_url: selection.product_url || "",
    vendor_id: selection.vendor_id || "",
    vendor_name: selection.vendor_name || "",
    subcontractor_id: selection.subcontractor_id || "",
    subcontractor_name: selection.subcontractor_name || "",
    designer_user_id: selection.designer_user_id || "",
    designer_name: selection.designer_name || "",
    related_task_id: selection.related_task_id || selection.project_schedule_item_id || "",
    selection_status: selection.selection_status || "draft",
    approval_status: selection.approval_status || "not_required",
    procurement_status: selection.procurement_status || "not_ordered",
    install_status: selection.install_status || "not_ready",
    client_visible: Boolean(selection.client_visible),
    client_approval_required: Boolean(selection.client_approval_required),
    quantity: String(selection.quantity || 1),
    unit: selection.unit || "each",
    allowance_amount: selection.allowance_amount == null ? "" : String(selection.allowance_amount),
    estimated_cost: selection.estimated_cost == null ? "" : String(selection.estimated_cost),
    actual_cost: selection.actual_cost == null ? "" : String(selection.actual_cost),
    client_price: selection.client_price == null ? "" : String(selection.client_price),
    lead_time_days: selection.lead_time_days == null ? "" : String(selection.lead_time_days),
    target_decision_date: selection.target_decision_date || "",
    target_order_date: selection.target_order_date || "",
    target_delivery_date: selection.target_delivery_date || "",
    target_install_date: selection.target_install_date || "",
    client_comments: selection.client_comments || "",
    internal_notes: selection.internal_notes || ""
  };
}

function draftToProduct(draft: ProductDraft): Product {
  return {
    id: draft.id || crypto.randomUUID(),
    product_name: draft.product_name || "Untitled product",
    product_slug: null,
    category: draft.category || null,
    product_type: draft.product_type || null,
    brand: draft.brand || null,
    manufacturer: draft.manufacturer || null,
    sku: draft.sku || null,
    model_number: draft.model_number || null,
    vendor_id: null,
    vendor_name: draft.vendor_name || null,
    description: draft.description || null,
    image_url: draft.image_url || null,
    gallery_urls: parseUrlList(draft.gallery_urls),
    video_url: draft.video_url || null,
    spec_sheet_url: draft.spec_sheet_url || null,
    product_url: draft.product_url || null,
    unit_cost: draft.unit_cost ? Number(draft.unit_cost) : null,
    retail_price: draft.retail_price ? Number(draft.retail_price) : null,
    markup_percent: draft.markup_percent ? Number(draft.markup_percent) : null,
    lead_time_days: draft.lead_time_days ? Number(draft.lead_time_days) : null,
    availability_status: draft.availability_status as Product["availability_status"],
    warranty_info: draft.warranty_info || null,
    install_notes: draft.install_notes || null,
    internal_notes: draft.internal_notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function draftToSelection(draft: SelectionDraft): ProjectSelection {
  const allowance = draft.allowance_amount ? Number(draft.allowance_amount) : null;
  const actual = draft.actual_cost ? Number(draft.actual_cost) : null;
  return {
    id: draft.id || crypto.randomUUID(),
    project_id: draft.project_id || null,
    project_schedule_item_id: draft.related_task_id || null,
    project_name: draft.project_name || null,
    client_id: draft.client_id || null,
    client_name: draft.client_name || null,
    room_area_name: draft.room_area_name || null,
    category: draft.category || null,
    name: draft.name || draft.custom_product_name || "Untitled selection",
    product_id: draft.product_id || null,
    custom_product_name: draft.custom_product_name || null,
    description: draft.description || null,
    image_url: draft.image_url || null,
    gallery_urls: parseUrlList(draft.gallery_urls),
    video_url: draft.video_url || null,
    spec_sheet_url: draft.spec_sheet_url || null,
    product_url: draft.product_url || null,
    vendor_id: draft.vendor_id || null,
    vendor_name: draft.vendor_name || null,
    subcontractor_id: draft.subcontractor_id || null,
    subcontractor_name: draft.subcontractor_name || null,
    designer_user_id: draft.designer_user_id || null,
    designer_name: draft.designer_name || null,
    related_task_id: draft.related_task_id || null,
    quote_id: null,
    sow_id: null,
    contract_id: null,
    invoice_id: null,
    selection_status: draft.selection_status as ProjectSelection["selection_status"],
    approval_status: draft.approval_status as ProjectSelection["approval_status"],
    procurement_status: draft.procurement_status as ProjectSelection["procurement_status"],
    install_status: draft.install_status as ProjectSelection["install_status"],
    client_visible: draft.client_visible,
    client_approval_required: draft.client_approval_required,
    client_comments: draft.client_comments || null,
    quantity: draft.quantity ? Number(draft.quantity) : 1,
    unit: draft.unit || null,
    allowance_amount: allowance,
    estimated_cost: draft.estimated_cost ? Number(draft.estimated_cost) : null,
    actual_cost: actual,
    client_price: draft.client_price ? Number(draft.client_price) : null,
    over_under_amount: allowance != null && actual != null ? actual - allowance : null,
    markup_amount: null,
    tax_amount: null,
    total_amount: draft.client_price ? Number(draft.client_price) : null,
    lead_time_days: draft.lead_time_days ? Number(draft.lead_time_days) : null,
    target_decision_date: draft.target_decision_date || null,
    target_order_date: draft.target_order_date || null,
    target_delivery_date: draft.target_delivery_date || null,
    target_install_date: draft.target_install_date || null,
    internal_notes: draft.internal_notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
