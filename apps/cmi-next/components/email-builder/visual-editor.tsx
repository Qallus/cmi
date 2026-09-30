"use client";

import * as React from "react";
import {
  GripVertical, Trash2, Plus, Type, AlignLeft, MousePointerClick,
  ImageIcon, Minus, SeparatorHorizontal, PanelBottom, LayoutTemplate,
  Columns2, Upload as UploadIcon, Code2, List as ListIcon, Settings2, X as XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMAIL_DEFAULTS, EMAIL_FONTS, LIST_MARKERS,
  type EmailBlock, type BlockType, type ColumnItem, type EmailSettings, type ListStyle,
} from "./types";
import { blocksToHtml } from "./renderer";
import { DynamicFieldsBar } from "@/components/ui/dynamic-fields-bar";
import { useResizablePane } from "@/components/ui/resizable-pane";
import { EmailPreview } from "./email-preview";

// -- Palette -------------------------------------------------------------------

const PALETTE: { type: BlockType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "header",  label: "Header",   icon: LayoutTemplate,      desc: "Logo / brand bar" },
  { type: "columns", label: "Columns",  icon: Columns2,            desc: "2 or 3 column layout" },
  { type: "heading", label: "Heading",  icon: Type,                desc: "H1, H2 or H3 title" },
  { type: "text",    label: "Text",     icon: AlignLeft,           desc: "Body paragraph" },
  { type: "list",    label: "List",     icon: ListIcon,            desc: "Bullets, numbers or icons" },
  { type: "button",  label: "Button",   icon: MousePointerClick,   desc: "CTA button with link" },
  { type: "image",   label: "Image",    icon: ImageIcon,           desc: "Image with optional link" },
  { type: "divider", label: "Divider",  icon: Minus,               desc: "Horizontal rule" },
  { type: "spacer",  label: "Spacer",   icon: SeparatorHorizontal, desc: "Empty vertical gap" },
  { type: "html",    label: "HTML",     icon: Code2,               desc: "Raw HTML snippet" },
  { type: "footer",  label: "Footer",   icon: PanelBottom,         desc: "Company info footer" },
];

// Strip <script> for safety (staff-authored, but rendered in-app + exported).
function stripScripts(html: string): string {
  return (html ?? "").replace(/<script[\s\S]*?<\/script>/gi, "");
}

// -- Defaults ------------------------------------------------------------------

function uid() { return Math.random().toString(36).slice(2, 10); }

// A column is a composite: optional image, heading, body text, and button.
function defaultColumnItem(): Omit<ColumnItem, "id"> {
  return { type: "text", src: "", alt: "", link: "", text: "Heading", heading_size: 16, heading_color: "#111111", content: "Add supporting text here.", color: "#4b5563", font_size: 14, items: [], list_style: "bullet", marker_color: "#C87A3A", label: "", url: "", btn_bg: "#C87A3A", btn_color: "#ffffff", btn_radius: 6, align: "left" };
}

function defaultBlock(type: BlockType): Omit<EmailBlock, "id"> {
  const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://my.constructedmatter.com";
  switch (type) {
    case "header":  return { type, logo_url: `${APP_URL}/brand/cmi_line_logo_white.png`, bg_color: "#111111", logo_width: 180 };
    case "heading": return { type, text: "Your Heading", level: "h1", color: "#111111", font_size: 28, align: "left" };
    case "text":    return { type, content: "Write your message here. Keep it clear and concise.", color: "#4b5563", font_size: 15, align: "left" };
    case "button":  return { type, label: "Click Here", url: "#", btn_bg: "#C87A3A", btn_color: "#ffffff", btn_radius: 6, align: "center" };
    case "image":   return { type, src: "", alt: "", img_width: 480, align: "center", link: "" };
    case "divider": return { type, border_color: "#eeeeee", thickness: 1 };
    case "spacer":  return { type, height: 24 };
    case "list":    return {
      type, list_style: "bullet", items: ["First point", "Second point", "Third point"],
      color: "#4b5563", font_size: 15, marker_color: "#C87A3A", item_spacing: 8,
    };
    case "html":    return { type, html: "<p style=\"font-family:Arial,sans-serif;font-size:15px;color:#111;\">Your custom HTML here.</p>" };
    case "footer":  return { type, company: "Constructed Matter, Inc.", address: "7314 E Osborn Dr Suite A - Scottsdale, AZ 85251", disclaimer: "If you weren't expecting this email, you can safely ignore it." };
    case "columns": return {
      type, col_count: 3,
      columns: [
        { id: uid(), ...defaultColumnItem() },
        { id: uid(), ...defaultColumnItem() },
        { id: uid(), ...defaultColumnItem() },
      ],
    };
  }
}


/** The marker a list item shows, matching what the renderer emits. */
function markerFor(style: ListStyle | undefined, icon: string | undefined, index: number): string {
  if (style === "number") return `${index + 1}.`;
  if (style === "icon") return icon || LIST_MARKERS.bullet;
  return LIST_MARKERS[(style ?? "bullet") as keyof typeof LIST_MARKERS] ?? LIST_MARKERS.bullet;
}

function ListPreview({
  items, style, icon, color, markerColor, fontSize, spacing, lineHeight,
}: {
  items?: string[]; style?: ListStyle; icon?: string;
  color?: string; markerColor?: string; fontSize?: number; spacing?: number; lineHeight?: number;
}) {
  const rows = (items ?? []).filter((i) => i.trim() !== "");
  if (rows.length === 0) {
    return <div style={{ color: "#9ca3af", fontSize: 12 }}>Empty list</div>;
  }
  return (
    <div>
      {rows.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: i === rows.length - 1 ? 0 : (spacing ?? 8) }}>
          <span style={{ color: markerColor ?? color ?? "#4b5563", fontSize: fontSize ?? 15, lineHeight: lineHeight ?? 1.6, whiteSpace: "nowrap" }}>
            {markerFor(style, icon, i)}
          </span>
          <span style={{ color: color ?? "#4b5563", fontSize: fontSize ?? 15, lineHeight: lineHeight ?? 1.6 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

// -- Block Previews ------------------------------------------------------------

// Composite column preview: image, then heading, body, and button — whichever are set.
function ColPreview({ col }: { col: ColumnItem }) {
  const ta = (col.align ?? "left") as "left" | "center" | "right";
  const empty = !col.src && !col.text && !col.content && !col.label && !col.items?.length;
  if (empty) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 60, color: "#9ca3af", fontSize: 11 }}>Empty column</div>;
  return (
    <div style={{ padding: 8, textAlign: ta }}>
      {col.src ? <img src={col.src} alt={col.alt ?? ""} style={{ width: "100%", height: "auto", display: "block", marginBottom: 6 }} /> : null}
      {col.text ? <div style={{ fontSize: col.heading_size ?? 16, fontWeight: 700, color: col.heading_color ?? "#111111", lineHeight: 1.3, marginBottom: 3 }}>{col.text}</div> : null}
      {col.content ? <div style={{ fontSize: col.font_size ?? 13, color: col.color ?? "#4b5563", lineHeight: col.line_height ?? 1.5, marginBottom: 4, whiteSpace: "pre-wrap" }}>{col.content}</div> : null}
      {col.items?.length ? <div style={{ marginBottom: 6 }}><ListPreview items={col.items} style={col.list_style} icon={col.list_icon} color={col.color} markerColor={col.marker_color} fontSize={col.font_size} lineHeight={col.line_height} /></div> : null}
      {col.label ? <span style={{ display: "inline-block", background: col.btn_bg ?? "#C87A3A", color: col.btn_color ?? "#fff", borderRadius: col.btn_radius ?? 6, padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>{col.label}</span> : null}
    </div>
  );
}

// Live padding for the canvas preview — honors the block's pad overrides so the
// properties panel reflects immediately (falls back to each block's defaults).
// Order matches CSS shorthand: top right bottom left.
function previewPad(block: EmailBlock, defT: number, defX: number, defB: number): string {
  const t = block.pad_top    ?? defT;
  const l = block.pad_left   ?? block.pad_x ?? defX;
  const r = block.pad_right  ?? block.pad_x ?? defX;
  const b = block.pad_bottom ?? defB;
  return `${t}px ${r}px ${b}px ${l}px`;
}

function BlockPreview({ block }: { block: EmailBlock }) {
  switch (block.type) {
    case "header":
      return (
        <div style={{ background: block.bg_color ?? "#111111", padding: previewPad(block, 20, 32, 20), textAlign: block.align ?? "center" }}>
          {block.logo_url
            ? <img src={block.logo_url} alt="Logo" width={block.logo_width ?? 180} style={{ width: block.logo_width ?? 180, maxWidth: "100%", height: "auto", display: "inline-block" }} />
            : <span style={{ color: "#ffffff", fontSize: 14, fontWeight: 600 }}>Logo Header</span>}
        </div>
      );
    case "heading":
      return (
        <div style={{ padding: previewPad(block, 12, 32, 4), textAlign: block.align ?? "left" }}>
          <span style={{ fontSize: block.font_size ?? 28, fontWeight: 700, color: block.color ?? "#111111", lineHeight: block.line_height ?? 1.3 }}>
            {block.text || "Heading"}
          </span>
        </div>
      );
    case "text":
      return (
        <div style={{ padding: previewPad(block, 4, 32, 4), textAlign: block.align ?? "left" }}>
          <span style={{ fontSize: block.font_size ?? 15, color: block.color ?? "#4b5563", lineHeight: block.line_height ?? 1.7 }}>
            {block.content || "Your text here."}
          </span>
        </div>
      );
    case "button":
      return (
        <div style={{ padding: previewPad(block, 12, 32, 12), textAlign: block.align ?? "center" }}>
          <span style={{ display: "inline-block", background: block.btn_bg ?? "#C87A3A", color: block.btn_color ?? "#ffffff", borderRadius: block.btn_radius ?? 6, padding: "12px 28px", fontSize: 14, fontWeight: 700 }}>
            {block.label || "Click Here"} {"->"}
          </span>
        </div>
      );
    case "image":
      return (
        <div style={{ padding: previewPad(block, 8, 32, 8), textAlign: block.align ?? "center" }}>
          {block.src
            ? <img src={block.src} alt={block.alt ?? ""} width={block.img_width ?? 480} style={{ width: block.img_width ?? 480, maxWidth: "100%", height: "auto", display: "inline-block" }} />
            : <div style={{ width: "100%", height: 100, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13, borderRadius: 4 }}>No image URL set</div>}
        </div>
      );
    case "divider":
      return (
        <div style={{ padding: previewPad(block, 8, 32, 8) }}>
          <div style={{ borderTop: `${block.thickness ?? 1}px solid ${block.border_color ?? "#eeeeee"}` }} />
        </div>
      );
    case "spacer":
      return <div style={{ height: block.height ?? 24, background: "repeating-linear-gradient(45deg,#f9f9f9,#f9f9f9 4px,#f3f4f6 4px,#f3f4f6 8px)" }} />;
    case "html":
      return block.html?.trim()
        ? <div style={{ padding: previewPad(block, 8, 24, 8) }} dangerouslySetInnerHTML={{ __html: stripScripts(block.html) }} />
        : <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 12, fontFamily: "monospace" }}>&lt;/&gt; Empty HTML block</div>;
    case "footer":
      return (
        <div style={{ padding: "16px 32px", textAlign: "center", borderTop: "1px solid #eeeeee" }}>
          <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{block.company ?? "Constructed Matter, Inc."}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{block.address ?? "7314 E Osborn Dr Suite A - Scottsdale, AZ 85251"}</div>
          <div style={{ fontSize: 11, color: "#c4c4c4", marginTop: 8 }}>{block.disclaimer ?? ""}</div>
        </div>
      );
    case "list":
      return (
        <div style={{ padding: previewPad(block, 8, 32, 16) }}>
          <ListPreview
            items={block.items} style={block.list_style} icon={block.list_icon}
            color={block.color} markerColor={block.marker_color}
            fontSize={block.font_size} spacing={block.item_spacing} lineHeight={block.line_height}
          />
        </div>
      );
    case "columns": {
      const count = block.col_count ?? 2;
      const cols  = block.columns ?? [];
      return (
        <div style={{ padding: previewPad(block, 12, 16, 12), display: "flex", gap: 6 }}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ flex: 1, border: "1.5px dashed #d1d5db", borderRadius: 4, overflow: "hidden", minHeight: 60 }}>
              {cols[i]
                ? <ColPreview col={cols[i]} />
                : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 60, color: "#9ca3af", fontSize: 11 }}>Col {i + 1}</div>}
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

// -- Settings Panel helpers ----------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

function ColorField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={safeHex}
          onChange={e => onChange(e.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border p-0.5 bg-background"
        />
        <input
          className={inputCls}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "#000000"}
        />
      </div>
    </Field>
  );
}

// Image field: paste a URL or upload a file (to the cmi-media bucket), with a preview.
function ImageInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  async function upload(file: File) {
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", "prints");
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const d = await res.json() as { url?: string; message?: string };
      if (res.ok && d.url) onChange(d.url); else setErr(d.message ?? "Upload failed.");
    } catch { setErr("Upload failed."); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "https://…"} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60">
          <UploadIcon className="h-3.5 w-3.5" /> {busy ? "…" : "Upload"}
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      {err ? <p className="text-[11px] text-destructive">{err}</p> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value ? <img src={value} alt="" className="h-16 w-full rounded border border-border bg-muted/30 object-contain" /> : null}
    </div>
  );
}

function AlignButtons({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {(["left", "center", "right"] as const).map(a => (
        <button key={a} type="button" onClick={() => onChange(a)}
          className={cn("flex-1 rounded border py-1 text-xs font-medium capitalize transition", value === a ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40")}>
          {a}
        </button>
      ))}
    </div>
  );
}

function NumberRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

// Common section/spacing settings shared by all block types
function SectionSettings({ block, onChange }: { block: EmailBlock; onChange: (p: Partial<EmailBlock>) => void }) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Section</div>
      <ColorField
        label="Background Color"
        value={block.section_bg ?? ""}
        onChange={v => onChange({ section_bg: v || undefined })}
        placeholder="transparent"
      />
      <Field label="Pad Top (px)">
        <input className={inputCls} type="number" min={0} max={120}
          value={block.pad_top ?? ""} placeholder="default"
          onChange={e => onChange({ pad_top: e.target.value ? Number(e.target.value) : undefined })}
        />
      </Field>
      <Field label="Pad Bottom (px)">
        <input className={inputCls} type="number" min={0} max={120}
          value={block.pad_bottom ?? ""} placeholder="default"
          onChange={e => onChange({ pad_bottom: e.target.value ? Number(e.target.value) : undefined })}
        />
      </Field>
      <Field label="Pad Left (px)">
        <input className={inputCls} type="number" min={0} max={120}
          value={block.pad_left ?? block.pad_x ?? ""} placeholder="default"
          onChange={e => onChange({ pad_left: e.target.value ? Number(e.target.value) : undefined })}
        />
      </Field>
      <Field label="Pad Right (px)">
        <input className={inputCls} type="number" min={0} max={120}
          value={block.pad_right ?? block.pad_x ?? ""} placeholder="default"
          onChange={e => onChange({ pad_right: e.target.value ? Number(e.target.value) : undefined })}
        />
      </Field>
    </div>
  );
}

// -- Block Settings Panel ------------------------------------------------------


const LIST_STYLES: { value: ListStyle; label: string }[] = [
  { value: "bullet", label: "Bullet" },
  { value: "number", label: "Number" },
  { value: "check", label: "Check" },
  { value: "dash", label: "Dash" },
  { value: "arrow", label: "Arrow" },
  { value: "icon", label: "Icon" },
];

/**
 * The list editor, shared by the List block and a column holding a list.
 *
 * Items are one per line rather than a row of inputs: pasting a list someone
 * sent over is the common case, and it just works.
 */
function ListFields({
  items, style, icon, markerColor, spacing, onChange, compact,
}: {
  items?: string[];
  style?: ListStyle;
  icon?: string;
  markerColor?: string;
  spacing?: number;
  compact?: boolean;
  onChange: (patch: { items?: string[]; list_style?: ListStyle; list_icon?: string; marker_color?: string; item_spacing?: number }) => void;
}) {
  return (
    <>
      <Field label="Items (one per line)">
        <textarea
          className={cn(inputCls, compact ? "min-h-[72px]" : "min-h-[110px]", "resize-y")}
          value={(items ?? []).join("\n")}
          onChange={(e) => onChange({ items: e.target.value.split("\n") })}
          placeholder={"Licensed and insured\nTwo-week lead time\nFree site walk"}
        />
      </Field>
      <Field label="Marker">
        <div className="grid grid-cols-3 gap-1">
          {LIST_STYLES.map((o) => (
            <button
              key={o.value} type="button" onClick={() => onChange({ list_style: o.value })}
              className={cn(
                "rounded border py-1 text-[11px] font-medium transition",
                (style ?? "bullet") === o.value ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      {style === "icon" && (
        <Field label="Icon character">
          <input
            className={inputCls} value={icon ?? ""} maxLength={4}
            onChange={(e) => onChange({ list_icon: e.target.value })}
            placeholder="&#9733;"
          />
        </Field>
      )}
      <NumberRow>
        <Field label="Marker Color">
          <input className={inputCls} value={markerColor ?? ""} placeholder="#C87A3A"
            onChange={(e) => onChange({ marker_color: e.target.value || undefined })} />
        </Field>
        {!compact && (
          <Field label="Gap (px)">
            <input className={inputCls} type="number" min={0} max={40} value={spacing ?? 8}
              onChange={(e) => onChange({ item_spacing: Number(e.target.value) })} />
          </Field>
        )}
      </NumberRow>
    </>
  );
}


/**
 * Line height, as a multiplier.
 *
 * Presets plus a number box: most of the time one of the four is what you want,
 * and the box covers the rest. Blank means the block type default, which is
 * what every email built before this setting existed already uses.
 */
function LineHeightField({
  value, fallback, onChange,
}: {
  value?: number;
  fallback: number;
  onChange: (v: number | undefined) => void;
}) {
  const PRESETS = [1.2, 1.4, 1.6, 1.8];
  return (
    <Field label="Line Height">
      <div className="flex items-center gap-1">
        {PRESETS.map((n) => (
          <button
            key={n} type="button" onClick={() => onChange(n)}
            className={cn(
              "flex-1 rounded border py-1 text-[11px] font-medium transition",
              value === n ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40",
            )}
          >
            {n}
          </button>
        ))}
        <input
          className={cn(inputCls, "w-16 shrink-0")}
          type="number" step={0.1} min={0.8} max={3}
          value={value ?? ""} placeholder={String(fallback)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </div>
    </Field>
  );
}

/** The brand marks that ship with the app, for the header block. */
const BRAND_LOGOS: { label: string; file: string; svg?: boolean }[] = [
  // The full-resolution line lockup first: it is the primary mark and what the
  // site header uses, so an email led by it looks like the rest of the brand.
  { label: "Line, white", file: "/brand/cmi_line_logo_white.png" },
  { label: "Line, black", file: "/brand/cmi_line_logo_black.png" },
  { label: "Stacked, light", file: "/brand/cmi-logo-light.png" },
  { label: "Stacked, dark", file: "/brand/cmi-logo-dark.png" },
  { label: "App icon, white", file: "/brand/cmi_app_icon_white.png" },
  { label: "App icon, black", file: "/brand/cmi_app_icon_black.png" },
  // SVG last and marked: Gmail and Outlook strip it, so these render as
  // nothing in most inboxes. Fine for a Print document, not for email.
  { label: "Line, white", file: "/brand/CMI_Line_Logo_White.svg", svg: true },
  { label: "Line, black", file: "/brand/CMI_Line_Logo_Black.svg", svg: true },
  { label: "Mark", file: "/brand/cmi-mark.svg", svg: true },
];

/**
 * Pick a logo by looking at it.
 *
 * Each swatch previews on the bar colour actually in use, because the whole
 * difficulty is that a white logo vanishes on white and a black one vanishes
 * on black. The stored value is absolute: an email is read outside the app,
 * where a relative path resolves to nothing.
 */
function LogoPicker({ value, bg, onChange }: { value: string; bg: string; onChange: (v: string) => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {BRAND_LOGOS.map((logo) => {
        const url = `${origin}${logo.file}`;
        const selected = value === url || value.endsWith(logo.file);
        return (
          <button
            key={logo.file} type="button" onClick={() => onChange(url)}
            title={logo.svg ? `${logo.label} — SVG, will not show in most email clients` : logo.label}
            className={cn(
              "relative flex h-12 items-center justify-center rounded border p-1.5 transition",
              selected ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40",
            )}
            style={{ background: bg }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.file} alt={logo.label} className="max-h-full max-w-full object-contain" />
            {logo.svg && <span className="absolute right-0.5 top-0.5 rounded bg-amber-500 px-1 text-[8px] font-bold text-white">SVG</span>}
          </button>
        );
      })}
    </div>
  );
}

function BlockSettings({ block, onChange, onDelete }: {
  block: EmailBlock;
  onChange: (patch: Partial<EmailBlock>) => void;
  onDelete: () => void;
}) {
  const s = block;

  function updateCol(idx: number, patch: Partial<ColumnItem>) {
    const next = [...(s.columns ?? [])];
    next[idx] = { ...next[idx], ...patch };
    onChange({ columns: next });
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold capitalize">{s.type === "columns" ? "Columns" : s.type} Settings</span>
        <button type="button" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Delete block">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Header */}
      {s.type === "header" && <>
        <Field label="Logo">
          <LogoPicker value={s.logo_url ?? ""} bg={s.bg_color ?? "#111111"} onChange={v => onChange({ logo_url: v })} />
        </Field>
        <Field label="Or paste / upload your own"><ImageInput value={s.logo_url ?? ""} onChange={v => onChange({ logo_url: v })} placeholder="Logo URL or upload" /></Field>
        <NumberRow>
          <Field label="Logo Width (px)"><input className={inputCls} type="number" min={40} max={520} value={s.logo_width ?? 180} onChange={e => onChange({ logo_width: Number(e.target.value) })} /></Field>
          <Field label="Position"><AlignButtons value={s.align ?? "center"} onChange={v => onChange({ align: v as "left"|"center"|"right" })} /></Field>
        </NumberRow>
        <ColorField label="Bar Background" value={s.bg_color ?? "#111111"} onChange={v => onChange({ bg_color: v })} />
        <p className="text-[11px] leading-relaxed text-muted-foreground">Spacing around the bar is under Section below.</p>
      </>}

      {/* Heading */}
      {s.type === "heading" && <>
        <Field label="Text"><input className={inputCls} value={s.text ?? ""} onChange={e => onChange({ text: e.target.value })} /></Field>
        <LineHeightField value={s.line_height} fallback={1.3} onChange={v => onChange({ line_height: v })} />
        <Field label="Level">
          <select className={inputCls} value={s.level ?? "h1"} onChange={e => onChange({ level: e.target.value as "h1"|"h2"|"h3" })}>
            <option value="h1">H1 -- Large</option>
            <option value="h2">H2 -- Medium</option>
            <option value="h3">H3 -- Small</option>
          </select>
        </Field>
        <Field label="Font Size (px)"><input className={inputCls} type="number" min={12} max={60} value={s.font_size ?? 28} onChange={e => onChange({ font_size: Number(e.target.value) })} /></Field>
        <ColorField label="Color" value={s.color ?? "#111111"} onChange={v => onChange({ color: v })} />
        <Field label="Align"><AlignButtons value={s.align} onChange={v => onChange({ align: v as "left"|"center"|"right" })} /></Field>
      </>}

      {/* Text */}
      {s.type === "text" && <>
        <Field label="Content"><textarea className={cn(inputCls, "min-h-[100px] resize-y")} value={s.content ?? ""} onChange={e => onChange({ content: e.target.value })} /></Field>
        <Field label="Font Size (px)"><input className={inputCls} type="number" min={11} max={24} value={s.font_size ?? 15} onChange={e => onChange({ font_size: Number(e.target.value) })} /></Field>
        <LineHeightField value={s.line_height} fallback={1.7} onChange={v => onChange({ line_height: v })} />
        <ColorField label="Color" value={s.color ?? "#4b5563"} onChange={v => onChange({ color: v })} />
        <Field label="Align"><AlignButtons value={s.align} onChange={v => onChange({ align: v as "left"|"center"|"right" })} /></Field>
      </>}

      {/* Button */}
      {s.type === "button" && <>
        <Field label="Label"><input className={inputCls} value={s.label ?? ""} onChange={e => onChange({ label: e.target.value })} /></Field>
        <Field label="URL"><input className={inputCls} value={s.url ?? ""} onChange={e => onChange({ url: e.target.value })} placeholder="https://..." /></Field>
        <ColorField label="Button Background" value={s.btn_bg ?? "#C87A3A"} onChange={v => onChange({ btn_bg: v })} />
        <ColorField label="Button Text Color" value={s.btn_color ?? "#ffffff"} onChange={v => onChange({ btn_color: v })} />
        <Field label="Border Radius (px)"><input className={inputCls} type="number" min={0} max={30} value={s.btn_radius ?? 6} onChange={e => onChange({ btn_radius: Number(e.target.value) })} /></Field>
        <Field label="Align"><AlignButtons value={s.align} onChange={v => onChange({ align: v as "left"|"center"|"right" })} /></Field>
      </>}

      {/* Image */}
      {s.type === "image" && <>
        <Field label="Image"><ImageInput value={s.src ?? ""} onChange={v => onChange({ src: v })} placeholder="Image URL or upload" /></Field>
        <Field label="Alt Text"><input className={inputCls} value={s.alt ?? ""} onChange={e => onChange({ alt: e.target.value })} /></Field>
        <Field label="Link URL"><input className={inputCls} value={s.link ?? ""} onChange={e => onChange({ link: e.target.value })} placeholder="https://..." /></Field>
        <Field label="Width (px)"><input className={inputCls} type="number" min={16} max={900} value={s.img_width ?? 480} onChange={e => onChange({ img_width: Number(e.target.value) })} /></Field>
        <p className="text-[11px] leading-relaxed text-muted-foreground">Set this to the size you want it displayed at. A 50px icon uploaded at 2× for sharpness still wants 50 here.</p>
        <Field label="Align"><AlignButtons value={s.align} onChange={v => onChange({ align: v as "left"|"center"|"right" })} /></Field>
      </>}

      {/* Divider */}
      {s.type === "divider" && <>
        <ColorField label="Color" value={s.border_color ?? "#eeeeee"} onChange={v => onChange({ border_color: v })} />
        <Field label="Thickness (px)"><input className={inputCls} type="number" min={1} max={8} value={s.thickness ?? 1} onChange={e => onChange({ thickness: Number(e.target.value) })} /></Field>
      </>}

      {/* Spacer */}
      {s.type === "list" && <>
        <ListFields
          items={s.items} style={s.list_style} icon={s.list_icon}
          markerColor={s.marker_color} spacing={s.item_spacing}
          onChange={onChange}
        />
        <NumberRow>
          <Field label="Text Size"><input className={inputCls} type="number" min={11} max={24} value={s.font_size ?? 15} onChange={e => onChange({ font_size: Number(e.target.value) })} /></Field>
          <Field label="Text Color"><input className={inputCls} value={s.color ?? "#4b5563"} onChange={e => onChange({ color: e.target.value })} placeholder="#4b5563" /></Field>
        </NumberRow>
        <LineHeightField value={s.line_height} fallback={1.6} onChange={v => onChange({ line_height: v })} />
      </>}

      {s.type === "spacer" && <>
        <Field label="Height (px)"><input className={inputCls} type="number" min={8} max={120} value={s.height ?? 24} onChange={e => onChange({ height: Number(e.target.value) })} /></Field>
      </>}

      {/* HTML */}
      {s.type === "html" && <>
        <Field label="HTML"><textarea className={cn(inputCls, "min-h-[180px] resize-y font-mono text-xs")} value={s.html ?? ""} onChange={e => onChange({ html: e.target.value })} placeholder="<div>…</div>" /></Field>
        <p className="text-[11px] text-muted-foreground">Paste any HTML markup. &lt;script&gt; tags are removed for safety.</p>
      </>}

      {/* Footer */}
      {s.type === "footer" && <>
        <Field label="Company Name"><input className={inputCls} value={s.company ?? ""} onChange={e => onChange({ company: e.target.value })} /></Field>
        <Field label="Address"><input className={inputCls} value={s.address ?? ""} onChange={e => onChange({ address: e.target.value })} /></Field>
        <Field label="Disclaimer"><textarea className={cn(inputCls, "min-h-[60px] resize-y")} value={s.disclaimer ?? ""} onChange={e => onChange({ disclaimer: e.target.value })} /></Field>
      </>}

      {/* Columns — each column stacks an optional image, heading, text, and button. */}
      {s.type === "columns" && <>
        <Field label="Layout">
          <div className="flex gap-1">
            {([2, 3, 4] as const).map(n => (
              <button key={n} type="button"
                onClick={() => {
                  const existing = s.columns ?? [];
                  const next = Array.from({ length: n }).map((_, i) => existing[i] ?? { id: uid(), ...defaultColumnItem() });
                  onChange({ col_count: n, columns: next });
                }}
                className={cn(
                  "flex-1 rounded border py-1.5 text-xs font-semibold transition",
                  (s.col_count ?? 2) === n ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                )}>
                {n} Col
              </button>
            ))}
          </div>
        </Field>
        <p className="text-[11px] text-muted-foreground">Fill any of the fields below in each column — image, heading, text, list, and/or button. Leave a field blank to hide it. A long list reads better split across columns.</p>

        {(s.columns ?? []).map((col, idx) => (
          <div key={col.id} className="space-y-2.5 rounded-lg border border-border p-2.5">
            <span className="text-[11px] font-semibold text-accent">Column {idx + 1}</span>
            <Field label="Image"><ImageInput value={col.src ?? ""} onChange={v => updateCol(idx, { src: v })} placeholder="Image URL or upload" /></Field>
            <Field label="Heading"><input className={inputCls} value={col.text ?? ""} onChange={e => updateCol(idx, { text: e.target.value })} placeholder="Column title" /></Field>
            <NumberRow>
              <Field label="Heading Size"><input className={inputCls} type="number" min={12} max={36} value={col.heading_size ?? 16} onChange={e => updateCol(idx, { heading_size: Number(e.target.value) })} /></Field>
              <Field label="Heading Color"><input className={inputCls} value={col.heading_color ?? "#111111"} onChange={e => updateCol(idx, { heading_color: e.target.value })} placeholder="#111111" /></Field>
            </NumberRow>
            <Field label="Text"><textarea className={cn(inputCls, "min-h-[72px] resize-y")} value={col.content ?? ""} onChange={e => updateCol(idx, { content: e.target.value })} placeholder="Supporting text" /></Field>
            <NumberRow>
              <Field label="Text Size"><input className={inputCls} type="number" min={11} max={22} value={col.font_size ?? 14} onChange={e => updateCol(idx, { font_size: Number(e.target.value) })} /></Field>
              <Field label="Text Color"><input className={inputCls} value={col.color ?? "#4b5563"} onChange={e => updateCol(idx, { color: e.target.value })} placeholder="#4b5563" /></Field>
            </NumberRow>
            <ListFields
              compact
              items={col.items} style={col.list_style} icon={col.list_icon} markerColor={col.marker_color}
              onChange={(patch) => updateCol(idx, patch)}
            />
            <Field label="Button label (optional)"><input className={inputCls} value={col.label ?? ""} onChange={e => updateCol(idx, { label: e.target.value })} placeholder="Leave blank for no button" /></Field>
            {col.label ? <Field label="Button URL"><input className={inputCls} value={col.url ?? ""} onChange={e => updateCol(idx, { url: e.target.value })} placeholder="https://..." /></Field> : null}
            <Field label="Align"><AlignButtons value={col.align} onChange={v => updateCol(idx, { align: v as "left"|"center"|"right" })} /></Field>
          </div>
        ))}
      </>}

      {/* Common section / spacing -- all block types */}
      <SectionSettings block={s} onChange={onChange} />
    </div>
  );
}


/**
 * Document-level settings: the page around the blocks.
 *
 * Every field falls back to the default when cleared, so a blank means
 * "whatever it was before" rather than an empty string in the markup. Only
 * fonts that survive an email client are offered, because most clients drop
 * webfonts.
 */
function GeneralSettings({
  settings, onChange, onClose,
}: {
  settings: EmailSettings;
  onChange: (patch: Partial<EmailSettings>) => void;
  onClose: () => void;
}) {
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const d = EMAIL_DEFAULTS;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">General Settings</span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground">
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Applies to the whole email. Leave a field blank to use the default.
      </p>

      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Layout</div>
      <NumberRow>
        <Field label="Width (px)">
          <input className={inputCls} type="number" min={320} max={900} placeholder={String(d.width)}
            value={settings.width ?? ""} onChange={e => onChange({ width: num(e.target.value) })} />
        </Field>
        <Field label="Corner radius">
          <input className={inputCls} type="number" min={0} max={32} placeholder={String(d.corner_radius)}
            value={settings.corner_radius ?? ""} onChange={e => onChange({ corner_radius: num(e.target.value) })} />
        </Field>
      </NumberRow>
      <NumberRow>
        <Field label="Page pad Y">
          <input className={inputCls} type="number" min={0} max={120} placeholder={String(d.page_pad_y)}
            value={settings.page_pad_y ?? ""} onChange={e => onChange({ page_pad_y: num(e.target.value) })} />
        </Field>
        <Field label="Page pad X">
          <input className={inputCls} type="number" min={0} max={120} placeholder={String(d.page_pad_x)}
            value={settings.page_pad_x ?? ""} onChange={e => onChange({ page_pad_x: num(e.target.value) })} />
        </Field>
      </NumberRow>

      <div className="border-t border-border pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Colours</div>
      <ColorField label="Page Background" value={settings.page_bg ?? ""} placeholder={d.page_bg}
        onChange={v => onChange({ page_bg: v || undefined })} />
      <ColorField label="Email Background" value={settings.content_bg ?? ""} placeholder={d.content_bg}
        onChange={v => onChange({ content_bg: v || undefined })} />
      <ColorField label="Body Text" value={settings.text_color ?? ""} placeholder={d.text_color}
        onChange={v => onChange({ text_color: v || undefined })} />
      <ColorField label="Links" value={settings.link_color ?? ""} placeholder={d.link_color}
        onChange={v => onChange({ link_color: v || undefined })} />

      <div className="border-t border-border pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Type</div>
      <Field label="Font">
        <select
          className={inputCls}
          value={settings.font_family ?? d.font_family}
          onChange={e => onChange({ font_family: e.target.value })}
        >
          {EMAIL_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </Field>
      <Field label="Base size (px)">
        <input className={inputCls} type="number" min={11} max={24} placeholder={String(d.font_size)}
          value={settings.font_size ?? ""} onChange={e => onChange({ font_size: num(e.target.value) })} />
      </Field>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        A block with its own size or colour keeps it.
      </p>
    </div>
  );
}

// -- Main Visual Editor --------------------------------------------------------

export function VisualEditor({ blocks, onChange, pageWidth, settings, onSettingsChange }: {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
  /**
   * A fixed canvas width, for the Print builder's Letter page. Emails leave
   * this unset and take their width from General settings instead.
   */
  pageWidth?: number;
  settings?: EmailSettings;
  /** Absent for the Print builder, which has no document settings. */
  onSettingsChange?: (s: EmailSettings) => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [showGeneral, setShowGeneral] = React.useState(false);
  const previewHtml = React.useMemo(() => blocksToHtml(blocks, settings), [blocks, settings]);
  const canvasWidth = pageWidth ?? settings?.width ?? EMAIL_DEFAULTS.width;

  // Both side panels are draggable. Their widths are per-person, because
  // how much room the settings need depends on the screen you are on.
  const palette = useResizablePane("cmi-email-palette-w", 192, { min: 150, max: 380, side: "left" });
  const settingsPane = useResizablePane("cmi-email-settings-w", 256, { min: 200, max: 520, side: "right" });

  const selected = blocks.find(b => b.id === selectedId) ?? null;

  function addBlock(type: BlockType) {
    const block = { id: uid(), ...defaultBlock(type) } as EmailBlock;
    onChange([...blocks, block]);
    setSelectedId(block.id);
  }

  function updateBlock(id: string, patch: Partial<EmailBlock>) {
    onChange(blocks.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function deleteBlock(id: string) {
    onChange(blocks.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragOverId) setDragOverId(id);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const from = blocks.findIndex(b => b.id === dragId);
    const to   = blocks.findIndex(b => b.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setDragId(null);
    setDragOverId(null);
  }

  return (
    <div className="flex h-full">
      {/* Palette */}
      <div style={{ width: palette.width }} className="shrink-0 overflow-y-auto border-r border-border bg-card p-3">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Add Block</div>
        <div className="space-y-1.5">
          {PALETTE.map(({ type, label, icon: Icon, desc }) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type)}
              className="flex w-full items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition hover:border-accent/50 hover:bg-accent/5"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <div>
                <div className="text-xs font-semibold">{label}</div>
                <div className="text-[10px] leading-tight text-muted-foreground">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {palette.handle}

      {/* Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
            {onSettingsChange && (
              <button
                type="button"
                onClick={() => { setShowGeneral(true); setSelectedId(null); }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition",
                  showGeneral ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <Settings2 className="h-3.5 w-3.5" /> General
              </button>
            )}
          </div>
          <button type="button" onClick={() => setShowPreview(v => !v)}
            className="text-xs font-medium text-accent underline-offset-4 hover:underline">
            {showPreview ? "Hide Preview" : "Full Preview"}
          </button>
        </div>

        {/* Dynamic fields bar -- clipboard copy, paste into any block text field */}
        <DynamicFieldsBar onInsert={() => {}} clipboard />

        <div className="flex-1 overflow-y-auto p-6" style={{ background: settings?.page_bg || "#f4f4f4" }}>
          <div
            className="mx-auto overflow-hidden shadow-sm"
            style={{
              maxWidth: canvasWidth,
              background: settings?.content_bg || "#ffffff",
              borderRadius: settings?.corner_radius ?? EMAIL_DEFAULTS.corner_radius,
              fontFamily: settings?.font_family || undefined,
            }}
          >
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Plus className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Click a block type to add it</p>
              </div>
            ) : (
              blocks.map((block) => (
                <div
                  key={block.id}
                  draggable
                  onDragStart={e => handleDragStart(e, block.id)}
                  onDragOver={e => handleDragOver(e, block.id)}
                  onDrop={e => handleDrop(e, block.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  onClick={() => { setShowGeneral(false); setSelectedId(block.id === selectedId ? null : block.id); }}
                  style={{ background: block.section_bg ?? undefined }}
                  className={cn(
                    "group relative cursor-pointer border-2 transition",
                    selectedId === block.id ? "border-accent" : "border-transparent hover:border-accent/30",
                    dragOverId === block.id && dragId !== block.id ? "border-dashed border-accent bg-accent/5" : ""
                  )}
                >
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10 cursor-grab opacity-0 group-hover:opacity-100 transition">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <BlockPreview block={block} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {settingsPane.handle}
      {/* Settings Panel */}
      <div style={{ width: settingsPane.width }} className="shrink-0 overflow-y-auto border-l border-border bg-card">
        {selected ? (
          <BlockSettings
            block={selected}
            onChange={patch => updateBlock(selected.id, patch)}
            onDelete={() => deleteBlock(selected.id)}
          />
        ) : showGeneral && onSettingsChange ? (
          <GeneralSettings
            settings={settings ?? {}}
            onChange={patch => onSettingsChange({ ...settings, ...patch })}
            onClose={() => setShowGeneral(false)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <div className="text-xs font-medium text-muted-foreground">Click a block to edit its settings</div>
            {onSettingsChange && (
              <button type="button" onClick={() => setShowGeneral(true)}
                className="text-xs font-medium text-accent hover:underline">
                or open General settings
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full preview */}
      {showPreview && (
        <EmailPreview
          html={previewHtml} width={canvasWidth}
          startExpanded onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
