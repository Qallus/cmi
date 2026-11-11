"use client";

// The selection form shared by the Selections page and a job's Selections tab:
// the draft shape, its option lists, the editor panel and its upload pieces.
import * as React from "react";
import { CheckCircle2, FileText, Image, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { Product, ProjectSelection, SelectionsData } from "@/lib/selections/types";
import { SelectionCommentsThread } from "./selection-comments";

export type SelectionDraft = {
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
  size: string;
  finish: string;
  colors: string;
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
  // Also captured by the Chrome extension (all of its fields live here too).
  eyebrow: string;
  manufacturer: string;
  sku: string;
  model_number: string;
  long_description: string;
  /** One feature per line. */
  features: string;
  source_url: string;
  selection_group_id: string;
  visible_to_contractor: boolean;
  visible_to_vendor: boolean;
};

export const categories = ["Cabinets", "Countertops", "Tile", "Flooring", "Appliances", "Plumbing Fixtures", "Lighting Fixtures", "Hardware", "Paint", "Doors", "Windows", "Trim / Millwork", "Roofing", "Exterior Finish", "Landscape", "Outdoor Living", "Bathroom Fixtures", "Kitchen Fixtures", "Specialty Materials", "Custom Fabrication", "Client-Provided Product", "Vendor-Provided Product", "Other"];
export const roomAreas = ["Kitchen", "Primary Bathroom", "Guest Bathroom", "Powder Room", "Bedroom", "Living Room", "Dining Room", "Office", "Laundry Room", "Garage", "Casita", "Exterior", "Patio", "Backyard", "Front Yard", "Entry", "Mechanical Room", "Whole Home"];
export const selectionStatuses = ["draft", "needs_review", "pending_client_approval", "client_approved", "rejected_needs_revision", "approved_internally", "ordered", "backordered", "delivered", "installed", "canceled", "replaced", "completed"];
export const approvalStatuses = ["not_required", "pending", "approved", "rejected", "revision_requested", "approved_with_changes"];
export const procurementStatuses = ["not_ordered", "quote_requested", "quote_received", "ready_to_order", "ordered", "backordered", "partially_delivered", "delivered", "canceled"];
export const installStatuses = ["not_ready", "ready_for_install", "scheduled", "in_progress", "installed", "needs_correction", "completed"];

export function emptySelectionDraft(): SelectionDraft {
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
    size: "",
    finish: "",
    colors: "",
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
    internal_notes: "",
    eyebrow: "",
    manufacturer: "",
    sku: "",
    model_number: "",
    long_description: "",
    features: "",
    source_url: "",
    selection_group_id: "",
    visible_to_contractor: false,
    visible_to_vendor: false
  };
}

export function selectionToDraft(selection: ProjectSelection): SelectionDraft {
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
    size: selection.size || "",
    finish: selection.finish || "",
    colors: selection.colors || "",
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
    internal_notes: selection.internal_notes || "",
    eyebrow: selection.eyebrow || "",
    manufacturer: selection.manufacturer || "",
    sku: selection.sku || "",
    model_number: selection.model_number || "",
    long_description: selection.long_description || "",
    features: selectionFeatures(selection).join("\n"),
    source_url: selection.source_url || "",
    selection_group_id: selection.selection_group_id || "",
    visible_to_contractor: Boolean(selection.visible_to_contractor),
    visible_to_vendor: Boolean(selection.visible_to_vendor)
  };
}

/** Features from the column, or the copy older extension cards kept in metadata. */
function selectionFeatures(selection: ProjectSelection): string[] {
  if (Array.isArray(selection.features)) return selection.features.map(String);
  const meta = (selection as unknown as { metadata?: { features?: unknown } }).metadata;
  return meta && Array.isArray(meta.features) ? meta.features.map(String) : [];
}

/**
 * The selection editor: every selection field, media uploads (featured image,
 * gallery, video) with a URL fallback, in a panel that slides in from the right.
 * Used by the Selections page and by a job's Selections tab, so both edit the
 * same way.
 */
export function SelectionEditor({ data, products, draft, saving, error, onChange, onClose, onSave, commentsJobId }: { data: Pick<SelectionsData, "projects" | "contacts" | "subcontractors" | "staffUsers" | "tasks" | "groups">; products: Product[]; draft: SelectionDraft; saving: boolean; error?: string | null; onChange: (draft: SelectionDraft) => void; onClose: () => void; onSave: (draft: SelectionDraft) => void;
  /** Opened from a job: show the client ↔ team thread (with reply) instead of the old notes text. */
  commentsJobId?: string }) {
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
  const uploadManyGallery = async (files: File[]) => {
    if (!files.length) return;
    setUploading("gallery_urls"); setUploadError(null);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadMedia(f, "selections"));
      update("gallery_urls", [draft.gallery_urls, ...urls].filter(Boolean).join("\n"));
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
          {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
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
            <Field label="Eyebrow"><Input value={draft.eyebrow} onChange={event => update("eyebrow", event.target.value)} placeholder="e.g. Kitchen · Plumbing (small line above the title on the card)" /></Field>
            <Field label="Selection Group">
              <Select value={draft.selection_group_id} onChange={event => update("selection_group_id", event.target.value)}>
                <option value="">No group</option>
                {(data.groups ?? []).map(group => <option key={group.id} value={group.id}>{group.label}</option>)}
              </Select>
            </Field>
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
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Manufacturer"><Input value={draft.manufacturer} onChange={event => update("manufacturer", event.target.value)} placeholder="Kohler" /></Field>
            <Field label="SKU"><Input value={draft.sku} onChange={event => update("sku", event.target.value)} /></Field>
            <Field label="Model #"><Input value={draft.model_number} onChange={event => update("model_number", event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Size"><Input value={draft.size} onChange={event => update("size", event.target.value)} placeholder={'24" x 48"'} /></Field>
            <Field label="Finish"><Input value={draft.finish} onChange={event => update("finish", event.target.value)} placeholder="Matte / Polished" /></Field>
            <Field label="Colors"><Input value={draft.colors} onChange={event => update("colors", event.target.value)} placeholder="Limo, Melange, Sabbia" /></Field>
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
            onUploadMany={uploadManyGallery}
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
              </div>
              <Field label="Gallery URLs">
                <Textarea value={draft.gallery_urls} onChange={event => update("gallery_urls", event.target.value)} placeholder="One image URL per line, or comma-separated URLs." />
              </Field>
            </>
          ) : null}
          {/* The product's own page (Product URL) and the page it was captured from (Source Page). */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Product URL"><Input value={draft.product_url} onChange={event => update("product_url", event.target.value)} placeholder="https://vendor.com/product" /></Field>
            <Field label="Source Page"><Input value={draft.source_url} onChange={event => update("source_url", event.target.value)} placeholder="Where it was captured from" /></Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={draft.client_visible} onChange={event => update("client_visible", event.target.checked)} />
              Client visible
            </label>
            <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={draft.visible_to_contractor} onChange={event => update("visible_to_contractor", event.target.checked)} />
              Contractor visible
            </label>
            <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={draft.visible_to_vendor} onChange={event => update("visible_to_vendor", event.target.checked)} />
              Vendor visible
            </label>
            <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={draft.client_approval_required} onChange={event => update("client_approval_required", event.target.checked)} />
              Approval required
            </label>
          </div>
          <Field label="Short Description"><Textarea value={draft.description} onChange={event => update("description", event.target.value)} placeholder="One or two lines shown on the card." /></Field>
          <Field label="Long Description"><Textarea value={draft.long_description} onChange={event => update("long_description", event.target.value)} placeholder="Full details (shown in the card's expanded view)." /></Field>
          <Field label="Features (one per line)"><Textarea value={draft.features} onChange={event => update("features", event.target.value)} placeholder={"Solid brass\nLifetime warranty"} /></Field>
          {/* The client's words are theirs: read-only here (staff answer in the thread). */}
          <Field label="Client Comments">
            {commentsJobId && draft.id
              ? <div className="rounded-md border border-border p-3"><SelectionCommentsThread jobId={commentsJobId} selectionId={draft.id} compact /></div>
              : draft.client_comments
                ? <p className="whitespace-pre-line break-words rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{draft.client_comments}</p>
                : <p className="text-xs text-muted-foreground">No client comments yet. Clients comment from their portal; open the selection from its job to reply.</p>}
          </Field>
          <Field label="Internal Notes"><Textarea value={draft.internal_notes} onChange={event => update("internal_notes", event.target.value)} /></Field>
        </div>
        <ModalFooter saving={saving} saveLabel="Save Selection" onClose={onClose} onSave={() => onSave(draft)} />
      </div>
    </div>
  );
}

export function ModalHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
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

export function ModalFooter({ saving, saveLabel, onClose, onSave }: { saving: boolean; saveLabel: string; onClose: () => void; onSave: () => void }) {
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

export async function uploadMedia(file: File, folder: string) {
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

export function MediaUploadPanel({
  imageUrl,
  galleryUrls,
  videoUrl,
  uploading,
  onUpload,
  onUploadMany
}: {
  imageUrl: string;
  galleryUrls: string;
  videoUrl: string;
  uploading: string | null;
  onUpload: (field: "image_url" | "gallery_urls" | "video_url", file: File | null) => void;
  onUploadMany?: (files: File[]) => void;
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
          onFiles={files => onUploadMany?.(files)}
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

export function UploadBox({
  label,
  accept,
  icon,
  note,
  previewUrl,
  multiple,
  uploading,
  onFile,
  onFiles
}: {
  label: string;
  accept: string;
  icon: React.ReactNode;
  note?: string;
  previewUrl?: string;
  multiple?: boolean;
  uploading?: boolean;
  onFile: (file: File | null) => void;
  onFiles?: (files: File[]) => void;
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
          // Multi-file (gallery) uploads all at once so appends don't race and
          // clobber each other; single-file uses the per-file path.
          if (multiple && onFiles) onFiles(files);
          else files.forEach(file => onFile(file));
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function OptionSelect({ value, options, placeholder, onChange }: { value: string; options: string[]; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onChange={event => onChange(event.target.value)}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {/* Keep a value that isn't on the list (e.g. a category the Chrome extension read off a vendor page). */}
      {value && !options.includes(value) ? <option value={value}>{value}</option> : null}
      {options.map(option => <option key={option} value={option}>{label(option)}</option>)}
    </Select>
  );
}

export function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export function parseUrlList(value: string) {
  return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
}
