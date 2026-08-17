"use client";

import * as React from "react";
import {
  GripVertical, Trash2, Plus, Type, AlignLeft, MousePointerClick,
  ImageIcon, Minus, SeparatorHorizontal, PanelBottom, LayoutTemplate,
  Columns2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailBlock, BlockType, ColumnItem } from "./types";
import { blocksToHtml } from "./renderer";
import { DynamicFieldsBar } from "@/components/ui/dynamic-fields-bar";

// -- Palette -------------------------------------------------------------------

const PALETTE: { type: BlockType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "header",  label: "Header",   icon: LayoutTemplate,      desc: "Logo / brand bar" },
  { type: "columns", label: "Columns",  icon: Columns2,            desc: "2 or 3 column layout" },
  { type: "heading", label: "Heading",  icon: Type,                desc: "H1, H2 or H3 title" },
  { type: "text",    label: "Text",     icon: AlignLeft,           desc: "Body paragraph" },
  { type: "button",  label: "Button",   icon: MousePointerClick,   desc: "CTA button with link" },
  { type: "image",   label: "Image",    icon: ImageIcon,           desc: "Image with optional link" },
  { type: "divider", label: "Divider",  icon: Minus,               desc: "Horizontal rule" },
  { type: "spacer",  label: "Spacer",   icon: SeparatorHorizontal, desc: "Empty vertical gap" },
  { type: "footer",  label: "Footer",   icon: PanelBottom,         desc: "Company info footer" },
];

// -- Defaults ------------------------------------------------------------------

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultColumnItem(type: ColumnItem["type"]): Omit<ColumnItem, "id"> {
  switch (type) {
    case "image":   return { type, src: "", alt: "", link: "", align: "center" };
    case "text":    return { type, content: "Column text here.", color: "#4b5563", font_size: 14, align: "left" };
    case "button":  return { type, label: "Click Here", url: "#", btn_bg: "#C87A3A", btn_color: "#ffffff", btn_radius: 6, align: "center" };
    case "heading": return { type, text: "Heading", level: "h2", color: "#111111", font_size: 18, align: "left" };
  }
}

function defaultBlock(type: BlockType): Omit<EmailBlock, "id"> {
  const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://my.constructedmatter.com";
  switch (type) {
    case "header":  return { type, logo_url: `${APP_URL}/brand/CMI_Line_Logo_White.svg`, bg_color: "#111111", logo_width: 180 };
    case "heading": return { type, text: "Your Heading", level: "h1", color: "#111111", font_size: 28, align: "left" };
    case "text":    return { type, content: "Write your message here. Keep it clear and concise.", color: "#4b5563", font_size: 15, align: "left" };
    case "button":  return { type, label: "Click Here", url: "#", btn_bg: "#C87A3A", btn_color: "#ffffff", btn_radius: 6, align: "center" };
    case "image":   return { type, src: "", alt: "", img_width: 480, align: "center", link: "" };
    case "divider": return { type, border_color: "#eeeeee", thickness: 1 };
    case "spacer":  return { type, height: 24 };
    case "footer":  return { type, company: "Constructed Matter, Inc.", address: "7314 E Osborn Dr Suite A - Scottsdale, AZ 85251", disclaimer: "If you weren't expecting this email, you can safely ignore it." };
    case "columns": return {
      type, col_count: 2,
      columns: [
        { id: uid(), ...defaultColumnItem("image") },
        { id: uid(), ...defaultColumnItem("image") },
      ],
    };
  }
}

// -- Block Previews ------------------------------------------------------------

function ColPreview({ col }: { col: ColumnItem }) {
  switch (col.type) {
    case "image":
      return col.src
        ? <img src={col.src} alt={col.alt ?? ""} style={{ width: "100%", height: "auto", display: "block" }} />
        : <div style={{ background: "#f3f4f6", height: 72, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 11 }}>Image</div>;
    case "text":
      return (
        <div style={{ padding: 8, fontSize: col.font_size ?? 13, color: col.color ?? "#4b5563", textAlign: col.align ?? "left", lineHeight: 1.5 }}>
          {col.content || "Column text..."}
        </div>
      );
    case "button":
      return (
        <div style={{ padding: 8, textAlign: col.align ?? "center" }}>
          <span style={{ display: "inline-block", background: col.btn_bg ?? "#C87A3A", color: col.btn_color ?? "#fff", borderRadius: col.btn_radius ?? 6, padding: "7px 14px", fontSize: 12, fontWeight: 700 }}>
            {col.label || "Button"}
          </span>
        </div>
      );
    case "heading":
      return (
        <div style={{ padding: 8, fontSize: col.font_size ?? 16, fontWeight: 700, color: col.color ?? "#111111", textAlign: col.align ?? "left" }}>
          {col.text || "Heading"}
        </div>
      );
    default:
      return null;
  }
}

function BlockPreview({ block }: { block: EmailBlock }) {
  switch (block.type) {
    case "header":
      return (
        <div style={{ background: block.bg_color ?? "#111111", padding: "20px 32px", textAlign: "center" }}>
          {block.logo_url
            ? <img src={block.logo_url} alt="Logo" style={{ height: 32, width: "auto", display: "inline-block" }} />
            : <span style={{ color: "#ffffff", fontSize: 14, fontWeight: 600 }}>Logo Header</span>}
        </div>
      );
    case "heading":
      return (
        <div style={{ padding: "12px 32px 4px", textAlign: block.align ?? "left" }}>
          <span style={{ fontSize: block.font_size ?? 28, fontWeight: 700, color: block.color ?? "#111111", lineHeight: 1.3 }}>
            {block.text || "Heading"}
          </span>
        </div>
      );
    case "text":
      return (
        <div style={{ padding: "4px 32px", textAlign: block.align ?? "left" }}>
          <span style={{ fontSize: block.font_size ?? 15, color: block.color ?? "#4b5563", lineHeight: 1.7 }}>
            {block.content || "Your text here."}
          </span>
        </div>
      );
    case "button":
      return (
        <div style={{ padding: "12px 32px", textAlign: block.align ?? "center" }}>
          <span style={{ display: "inline-block", background: block.btn_bg ?? "#C87A3A", color: block.btn_color ?? "#ffffff", borderRadius: block.btn_radius ?? 6, padding: "12px 28px", fontSize: 14, fontWeight: 700 }}>
            {block.label || "Click Here"} {"->"}
          </span>
        </div>
      );
    case "image":
      return (
        <div style={{ padding: "8px 32px", textAlign: block.align ?? "center" }}>
          {block.src
            ? <img src={block.src} alt={block.alt ?? ""} style={{ maxWidth: "100%", height: "auto", display: "inline-block" }} />
            : <div style={{ width: "100%", height: 100, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13, borderRadius: 4 }}>No image URL set</div>}
        </div>
      );
    case "divider":
      return (
        <div style={{ padding: "8px 32px" }}>
          <div style={{ borderTop: `${block.thickness ?? 1}px solid ${block.border_color ?? "#eeeeee"}` }} />
        </div>
      );
    case "spacer":
      return <div style={{ height: block.height ?? 24, background: "repeating-linear-gradient(45deg,#f9f9f9,#f9f9f9 4px,#f3f4f6 4px,#f3f4f6 8px)" }} />;
    case "footer":
      return (
        <div style={{ padding: "16px 32px", textAlign: "center", borderTop: "1px solid #eeeeee" }}>
          <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{block.company ?? "Constructed Matter, Inc."}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{block.address ?? "7314 E Osborn Dr Suite A - Scottsdale, AZ 85251"}</div>
          <div style={{ fontSize: 11, color: "#c4c4c4", marginTop: 8 }}>{block.disclaimer ?? ""}</div>
        </div>
      );
    case "columns": {
      const count = block.col_count ?? 2;
      const cols  = block.columns ?? [];
      return (
        <div style={{ padding: `${block.pad_top ?? 12}px ${block.pad_x ?? 16}px ${block.pad_bottom ?? 12}px`, display: "flex", gap: 6 }}>
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
      <NumberRow>
        <Field label="Pad Top (px)">
          <input className={inputCls} type="number" min={0} max={120}
            value={block.pad_top ?? ""}
            placeholder="default"
            onChange={e => onChange({ pad_top: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="Pad Bottom (px)">
          <input className={inputCls} type="number" min={0} max={120}
            value={block.pad_bottom ?? ""}
            placeholder="default"
            onChange={e => onChange({ pad_bottom: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </NumberRow>
      <Field label="Pad Left / Right (px)">
        <input className={inputCls} type="number" min={0} max={120}
          value={block.pad_x ?? ""}
          placeholder="default"
          onChange={e => onChange({ pad_x: e.target.value ? Number(e.target.value) : undefined })}
        />
      </Field>
    </div>
  );
}

// -- Block Settings Panel ------------------------------------------------------

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

  function swapColType(idx: number, type: ColumnItem["type"]) {
    const next = [...(s.columns ?? [])];
    next[idx] = { id: next[idx]?.id ?? uid(), ...defaultColumnItem(type) };
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
        <Field label="Logo URL"><input className={inputCls} value={s.logo_url ?? ""} onChange={e => onChange({ logo_url: e.target.value })} placeholder="https://.../logo.svg" /></Field>
        <Field label="Logo Width (px)"><input className={inputCls} type="number" min={60} max={400} value={s.logo_width ?? 180} onChange={e => onChange({ logo_width: Number(e.target.value) })} /></Field>
        <ColorField label="Bar Background" value={s.bg_color ?? "#111111"} onChange={v => onChange({ bg_color: v })} />
      </>}

      {/* Heading */}
      {s.type === "heading" && <>
        <Field label="Text"><input className={inputCls} value={s.text ?? ""} onChange={e => onChange({ text: e.target.value })} /></Field>
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
        <Field label="Image URL"><input className={inputCls} value={s.src ?? ""} onChange={e => onChange({ src: e.target.value })} placeholder="https://.../image.jpg" /></Field>
        <Field label="Alt Text"><input className={inputCls} value={s.alt ?? ""} onChange={e => onChange({ alt: e.target.value })} /></Field>
        <Field label="Link URL"><input className={inputCls} value={s.link ?? ""} onChange={e => onChange({ link: e.target.value })} placeholder="https://..." /></Field>
        <Field label="Width (px)"><input className={inputCls} type="number" min={100} max={560} value={s.img_width ?? 480} onChange={e => onChange({ img_width: Number(e.target.value) })} /></Field>
        <Field label="Align"><AlignButtons value={s.align} onChange={v => onChange({ align: v as "left"|"center"|"right" })} /></Field>
      </>}

      {/* Divider */}
      {s.type === "divider" && <>
        <ColorField label="Color" value={s.border_color ?? "#eeeeee"} onChange={v => onChange({ border_color: v })} />
        <Field label="Thickness (px)"><input className={inputCls} type="number" min={1} max={8} value={s.thickness ?? 1} onChange={e => onChange({ thickness: Number(e.target.value) })} /></Field>
      </>}

      {/* Spacer */}
      {s.type === "spacer" && <>
        <Field label="Height (px)"><input className={inputCls} type="number" min={8} max={120} value={s.height ?? 24} onChange={e => onChange({ height: Number(e.target.value) })} /></Field>
      </>}

      {/* Footer */}
      {s.type === "footer" && <>
        <Field label="Company Name"><input className={inputCls} value={s.company ?? ""} onChange={e => onChange({ company: e.target.value })} /></Field>
        <Field label="Address"><input className={inputCls} value={s.address ?? ""} onChange={e => onChange({ address: e.target.value })} /></Field>
        <Field label="Disclaimer"><textarea className={cn(inputCls, "min-h-[60px] resize-y")} value={s.disclaimer ?? ""} onChange={e => onChange({ disclaimer: e.target.value })} /></Field>
      </>}

      {/* Columns */}
      {s.type === "columns" && <>
        <Field label="Layout">
          <div className="flex gap-1">
            {([2, 3] as const).map(n => (
              <button key={n} type="button"
                onClick={() => {
                  const existing = s.columns ?? [];
                  const next = Array.from({ length: n }).map((_, i) =>
                    existing[i] ?? { id: uid(), ...defaultColumnItem("image") }
                  );
                  onChange({ col_count: n, columns: next });
                }}
                className={cn(
                  "flex-1 rounded border py-1.5 text-xs font-semibold transition",
                  (s.col_count ?? 2) === n
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-accent/40"
                )}>
                {n} Columns
              </button>
            ))}
          </div>
        </Field>

        {(s.columns ?? []).map((col, idx) => (
          <div key={col.id} className="rounded-lg border border-border p-2.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-accent">Column {idx + 1}</span>
            </div>

            <Field label="Content Type">
              <select className={inputCls} value={col.type} onChange={e => swapColType(idx, e.target.value as ColumnItem["type"])}>
                <option value="image">Image</option>
                <option value="text">Text</option>
                <option value="button">Button</option>
                <option value="heading">Heading</option>
              </select>
            </Field>

            {col.type === "image" && <>
              <Field label="Image URL"><input className={inputCls} value={col.src ?? ""} onChange={e => updateCol(idx, { src: e.target.value })} placeholder="https://..." /></Field>
              <Field label="Alt Text"><input className={inputCls} value={col.alt ?? ""} onChange={e => updateCol(idx, { alt: e.target.value })} /></Field>
              <Field label="Link URL"><input className={inputCls} value={col.link ?? ""} onChange={e => updateCol(idx, { link: e.target.value })} placeholder="https://..." /></Field>
            </>}

            {col.type === "text" && <>
              <Field label="Content"><textarea className={cn(inputCls, "min-h-[72px] resize-y")} value={col.content ?? ""} onChange={e => updateCol(idx, { content: e.target.value })} /></Field>
              <NumberRow>
                <Field label="Font Size (px)"><input className={inputCls} type="number" min={11} max={22} value={col.font_size ?? 14} onChange={e => updateCol(idx, { font_size: Number(e.target.value) })} /></Field>
                <Field label="Color"><input className={inputCls} value={col.color ?? "#4b5563"} onChange={e => updateCol(idx, { color: e.target.value })} placeholder="#4b5563" /></Field>
              </NumberRow>
            </>}

            {col.type === "button" && <>
              <Field label="Label"><input className={inputCls} value={col.label ?? ""} onChange={e => updateCol(idx, { label: e.target.value })} /></Field>
              <Field label="URL"><input className={inputCls} value={col.url ?? ""} onChange={e => updateCol(idx, { url: e.target.value })} placeholder="https://..." /></Field>
              <NumberRow>
                <Field label="Bg Color"><input className={inputCls} value={col.btn_bg ?? "#C87A3A"} onChange={e => updateCol(idx, { btn_bg: e.target.value })} /></Field>
                <Field label="Text Color"><input className={inputCls} value={col.btn_color ?? "#ffffff"} onChange={e => updateCol(idx, { btn_color: e.target.value })} /></Field>
              </NumberRow>
            </>}

            {col.type === "heading" && <>
              <Field label="Text"><input className={inputCls} value={col.text ?? ""} onChange={e => updateCol(idx, { text: e.target.value })} /></Field>
              <NumberRow>
                <Field label="Font Size (px)"><input className={inputCls} type="number" min={12} max={36} value={col.font_size ?? 18} onChange={e => updateCol(idx, { font_size: Number(e.target.value) })} /></Field>
                <Field label="Color"><input className={inputCls} value={col.color ?? "#111111"} onChange={e => updateCol(idx, { color: e.target.value })} /></Field>
              </NumberRow>
            </>}

            <Field label="Align"><AlignButtons value={col.align} onChange={v => updateCol(idx, { align: v as "left"|"center"|"right" })} /></Field>
          </div>
        ))}
      </>}

      {/* Common section / spacing -- all block types */}
      <SectionSettings block={s} onChange={onChange} />
    </div>
  );
}

// -- Main Visual Editor --------------------------------------------------------

export function VisualEditor({ blocks, onChange, pageWidth = 560 }: {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
  /** Canvas width in px (email = 560; a Letter print page ≈ 816). */
  pageWidth?: number;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const previewHtml = React.useMemo(() => blocksToHtml(blocks), [blocks]);

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
      <div className="w-48 shrink-0 overflow-y-auto border-r border-border bg-card p-3">
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

      {/* Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
          <button type="button" onClick={() => setShowPreview(v => !v)}
            className="text-xs font-medium text-accent underline-offset-4 hover:underline">
            {showPreview ? "Hide Preview" : "Full Preview"}
          </button>
        </div>

        {/* Dynamic fields bar -- clipboard copy, paste into any block text field */}
        <DynamicFieldsBar onInsert={() => {}} clipboard />

        <div className="flex-1 overflow-y-auto bg-[#f4f4f4] p-6">
          <div className="mx-auto overflow-hidden rounded-lg bg-white shadow-sm" style={{ maxWidth: pageWidth }}>
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
                  onClick={() => setSelectedId(block.id === selectedId ? null : block.id)}
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

      {/* Settings Panel */}
      <div className="w-64 shrink-0 overflow-y-auto border-l border-border bg-card">
        {selected ? (
          <BlockSettings
            block={selected}
            onChange={patch => updateBlock(selected.id, patch)}
            onDelete={() => deleteBlock(selected.id)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Click a block to edit its settings</div>
          </div>
        )}
      </div>

      {/* Full preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="font-semibold text-sm">Email Preview</span>
            <button type="button" onClick={() => setShowPreview(false)} className="rounded px-3 py-1.5 text-sm border border-border hover:bg-muted">Close</button>
          </div>
          <div className="flex-1 overflow-auto bg-[#f4f4f4] p-6">
            <iframe
              srcDoc={previewHtml}
              style={{ width: pageWidth }}
              className="mx-auto block h-[800px] max-w-full rounded-lg border border-border bg-white shadow"
              title="Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}
