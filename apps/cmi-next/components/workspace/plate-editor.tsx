"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plate, PlateContent, PlateElement, PlateLeaf, usePlateEditor, createPlatePlugin, useEditorRef, usePath } from "platejs/react";
import { toggleList } from "@platejs/list";
import { ColumnPlugin, ColumnItemPlugin } from "@platejs/layout/react";
import { insertColumnGroup } from "@platejs/layout";
import { TocPlugin, useTocElementState, useTocElement } from "@platejs/toc/react";
import {
  BoldPlugin, ItalicPlugin, UnderlinePlugin, StrikethroughPlugin, CodePlugin, HighlightPlugin,
  H1Plugin, H2Plugin, H3Plugin, BlockquotePlugin, HorizontalRulePlugin,
} from "@platejs/basic-nodes/react";
import { CodeBlockPlugin, CodeLinePlugin } from "@platejs/code-block/react";
import { LinkPlugin } from "@platejs/link/react";
import { ListPlugin, useListToolbarButton, useListToolbarButtonState } from "@platejs/list/react";
import { FontColorPlugin, FontBackgroundColorPlugin, FontSizePlugin, TextAlignPlugin } from "@platejs/basic-styles/react";
import { TablePlugin, TableRowPlugin, TableCellPlugin, TableCellHeaderPlugin } from "@platejs/table/react";
import { insertTable, insertTableRow, insertTableColumn, deleteTable } from "@platejs/table";
import { insertLink, upsertLink } from "@platejs/link";
import { ImagePlugin, VideoPlugin, AudioPlugin, FilePlugin } from "@platejs/media/react";
import { useDashboardActionToken } from "@/components/workspace/ui/action-token";
import { BrandAudioPlayer } from "@/components/workspace/brand-audio-player";
import { LIVE_APP_PLUGINS, LIVE_APP_COMPONENTS, newProjectTrackerNode, newKanbanNode, newCalendarNode } from "@/components/workspace/live-apps";
import { Button } from "@/components/workspace/ui/button";
import { Input } from "@/components/workspace/ui/input";
import { Textarea } from "@/components/workspace/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/workspace/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/workspace/ui/dialog";
import {
  Bold, Italic, Underline, Strikethrough, Code, Highlighter, Heading1, Heading2, Heading3,
  Quote, Minus, SquareCode, Link2, List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Baseline, PaintBucket, Type, Table as TableIcon, Rows3, Columns3, Columns2, Trash2, Plus,
  Image as ImageIcon, Video, Music, Mic, FileCode2, Paperclip, AtSign, Smile, ListTree,
  Check, CheckSquare, CalendarDays, Boxes, ClipboardList, UserCircle, CalendarClock, ExternalLink, Sparkles,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Undo2, Redo2, Search as SearchIcon, RemoveFormatting, Maximize2, ChevronDown, Pilcrow, Settings2,
  FolderKanban, SquareKanban, CalendarRange, FileText, Hash,
} from "lucide-react";
import { DatePicker } from "@/components/workspace/ui/date-picker";
import { SimpleTooltip } from "@/components/workspace/ui/tooltip";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuCheckboxItem, DropdownMenuLabel,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/workspace/ui/dropdown-menu";
import { extractPlainText } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

// Custom void block: render pasted HTML in a sandboxed frame (distinct from a code block).
const HtmlEmbedPlugin = createPlatePlugin({ key: "html_embed", node: { isElement: true, isVoid: true } });
// Custom checkbox (todo) block + inline date field. Components are defined further down.
const TodoItemPlugin = createPlatePlugin({ key: "todo_item", node: { isElement: true } });
const DateFieldPlugin = createPlatePlugin({ key: "date_field", node: { isElement: true, isInline: true, isVoid: true } });
// Inline card linking to an MJG record (plan / participant / booking).
const RecordLinkPlugin = createPlatePlugin({ key: "record_link", node: { isElement: true, isInline: true, isVoid: true } });
// Inline clickable link to another Workspace document (inserted via the "#" picker).
const DocLinkPlugin = createPlatePlugin({ key: "doc_link", node: { isElement: true, isInline: true, isVoid: true } });

/* eslint-disable @typescript-eslint/no-explicit-any */
const PLUGINS = [
  BoldPlugin, ItalicPlugin, UnderlinePlugin, StrikethroughPlugin, CodePlugin, HighlightPlugin,
  H1Plugin, H2Plugin, H3Plugin, BlockquotePlugin, HorizontalRulePlugin,
  CodeBlockPlugin, CodeLinePlugin, LinkPlugin, ListPlugin,
  FontColorPlugin, FontBackgroundColorPlugin, FontSizePlugin, TextAlignPlugin,
  TablePlugin, TableRowPlugin, TableCellPlugin, TableCellHeaderPlugin,
  ImagePlugin, VideoPlugin, AudioPlugin, FilePlugin,
  ColumnPlugin, ColumnItemPlugin, HtmlEmbedPlugin, TocPlugin, TodoItemPlugin, DateFieldPlugin, RecordLinkPlugin, DocLinkPlugin,
  ...LIVE_APP_PLUGINS,
];

// TOC element: lists the document's headings with click-to-scroll (from @platejs/toc).
function TocElement() {
  const state = useTocElementState();
  const btn: any = useTocElement(state as any);
  const onClick = btn?.props?.onClick;
  const headings: any[] = (state as any)?.headingList ?? [];
  return (
    <div contentEditable={false} className="my-3 rounded-md border bg-muted/30 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Table of contents</p>
      {headings.length ? headings.map((h: any) => (
        <a key={h.id} onClick={(ev) => onClick?.(ev, h, "smooth")} style={{ paddingLeft: Math.max(0, (h.depth ?? 1) - 1) * 14 }} className="block cursor-pointer truncate rounded px-1 py-0.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">{h.title}</a>
      )) : <p className="text-xs text-muted-foreground">Add headings (H1–H3) to build the outline.</p>}
    </div>
  );
}

const COMPONENTS: Record<string, any> = {
  [BoldPlugin.key]: (p: any) => <PlateLeaf {...p} as="strong" />,
  [ItalicPlugin.key]: (p: any) => <PlateLeaf {...p} as="em" />,
  [UnderlinePlugin.key]: (p: any) => <PlateLeaf {...p} as="u" />,
  [StrikethroughPlugin.key]: (p: any) => <PlateLeaf {...p} as="s" />,
  [CodePlugin.key]: (p: any) => <PlateLeaf {...p} as="code" className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" />,
  [HighlightPlugin.key]: (p: any) => <PlateLeaf {...p} as="mark" className="rounded bg-amber-200/70 dark:bg-amber-300/30" />,
  [H1Plugin.key]: (p: any) => <PlateElement {...p} as="h1" className="mt-6 mb-2 text-3xl font-bold tracking-tight" />,
  [H2Plugin.key]: (p: any) => <PlateElement {...p} as="h2" className="mt-5 mb-2 text-2xl font-semibold tracking-tight" />,
  [H3Plugin.key]: (p: any) => <PlateElement {...p} as="h3" className="mt-4 mb-1.5 text-xl font-semibold" />,
  [BlockquotePlugin.key]: (p: any) => <PlateElement {...p} as="blockquote" className="my-2 border-l-2 border-accent/40 pl-4 italic text-muted-foreground" />,
  [HorizontalRulePlugin.key]: (p: any) => <PlateElement {...p} as="div" className="py-2"><hr className="border-border" />{p.children}</PlateElement>,
  [CodeBlockPlugin.key]: (p: any) => <PlateElement {...p} as="pre" className="my-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm" />,
  [CodeLinePlugin.key]: (p: any) => <PlateElement {...p} as="div" />,
  [LinkPlugin.key]: ({ element, children, attributes }: any) => (
    <a
      {...attributes}
      href={element?.url}
      target="_blank"
      rel="noreferrer"
      onClick={() => { if (element?.url && typeof window !== "undefined") window.open(element.url, "_blank", "noopener,noreferrer"); }}
      className="cursor-pointer text-accent underline underline-offset-2"
    >{children}</a>
  ),
  [TocPlugin.key]: (p: any) => <PlateElement {...p}><TocElement />{p.children}</PlateElement>,
  [TodoItemPlugin.key]: TodoItem,
  [DateFieldPlugin.key]: DateField,
  [RecordLinkPlugin.key]: (p: any) => {
    const el = p.element ?? {};
    const Icon = el.recordType === "plan" ? ClipboardList : el.recordType === "participant" ? UserCircle : CalendarClock;
    return (
      <PlateElement {...p} as="span" className="mx-0.5 inline-block align-middle">
        <span contentEditable={false} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-sm">
          <Icon className="h-3.5 w-3.5 text-accent" />
          <span className="font-medium">{el.label}</span>
          {el.sublabel ? <span className="text-xs text-muted-foreground">· {el.sublabel}</span> : null}
          <a href={el.href} title="Open record" onClick={(ev) => { ev.preventDefault(); if (el.href && typeof window !== "undefined") window.open(el.href, "_blank", "noopener,noreferrer"); }} className="ml-0.5 text-accent hover:text-accent/80"><ExternalLink className="h-3.5 w-3.5" /></a>
        </span>{p.children}
      </PlateElement>
    );
  },
  [DocLinkPlugin.key]: (p: any) => {
    const el = p.element ?? {};
    return (
      <PlateElement {...p} as="span" className="mx-0.5 inline-block align-middle">
        <a contentEditable={false} href={el.href} title="Open document" onClick={(ev) => { ev.preventDefault(); if (el.href && typeof window !== "undefined") window.location.assign(el.href); }} className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/5 px-1.5 py-0.5 text-sm font-medium text-accent no-underline transition-colors hover:bg-accent/10">
          <FileText className="h-3.5 w-3.5" />{el.title || "Untitled"}
        </a>{p.children}
      </PlateElement>
    );
  },
  // Tables render as real HTML tables. Border width/color live on the table node as
  // CSS variables so every cell inherits a full, closed grid the user can restyle.
  [TablePlugin.key]: (p: any) => {
    const bw = p.element?.borderWidth ?? 1;
    const bc = p.element?.borderColor ?? "var(--border)";
    return <PlateElement {...p} as="table" style={{ ["--tbl-bw" as any]: `${bw}px`, ["--tbl-bc" as any]: bc, border: `${bw}px solid ${bc}` }} className="my-3 w-full table-fixed border-collapse text-sm" />;
  },
  [TableRowPlugin.key]: (p: any) => <PlateElement {...p} as="tr" />,
  [TableCellPlugin.key]: (p: any) => <PlateElement {...p} as="td" style={{ borderWidth: "var(--tbl-bw,1px)", borderColor: "var(--tbl-bc,var(--border))", borderStyle: "solid", background: p.element?.background || undefined }} className="px-2 py-1 align-top" />,
  [TableCellHeaderPlugin.key]: (p: any) => <PlateElement {...p} as="th" style={{ borderWidth: "var(--tbl-bw,1px)", borderColor: "var(--tbl-bc,var(--border))", borderStyle: "solid", background: p.element?.background || "var(--muted)" }} className="px-2 py-1 text-left font-semibold" />,
  // Media (void nodes).
  [ImagePlugin.key]: (p: any) => <PlateElement {...p}><div contentEditable={false} className="my-2">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.element?.url} alt={p.element?.name || ""} className="max-h-[28rem] max-w-full rounded-md border" /></div>{p.children}</PlateElement>,
  [VideoPlugin.key]: (p: any) => <PlateElement {...p}><div contentEditable={false} className="my-2"><video controls src={p.element?.url} className="max-h-[28rem] max-w-full rounded-md border" /></div>{p.children}</PlateElement>,
  [AudioPlugin.key]: AudioBlock,
  [FilePlugin.key]: (p: any) => <PlateElement {...p}><div contentEditable={false} className="my-2"><a href={p.element?.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-accent hover:underline">📎 {p.element?.name || "Download file"}</a></div>{p.children}</PlateElement>,
  // Columns layout.
  [ColumnPlugin.key]: (p: any) => <PlateElement {...p} as="div" className="my-3 flex flex-col gap-4 md:flex-row" />,
  [ColumnItemPlugin.key]: (p: any) => <PlateElement {...p} as="div" className="min-w-0 flex-1 rounded-md border border-dashed border-border p-2" />,
  // HTML embed (sandboxed, script-disabled).
  [HtmlEmbedPlugin.key]: (p: any) => (
    <PlateElement {...p}>
      <div contentEditable={false} className="my-2 overflow-hidden rounded-md border">
        <iframe sandbox="allow-same-origin" title="HTML embed" className="h-[36rem] w-full bg-white" srcDoc={p.element?.html || "<p style='font-family:sans-serif;color:#888;padding:12px'>Empty HTML embed</p>"} />
      </div>{p.children}
    </PlateElement>
  ),
  ...LIVE_APP_COMPONENTS,
};

const TEXT_COLORS = ["inherit", "#1a1a1a", "#b45309", "#c2410c", "#dc2626", "#2563eb", "#6b7280"];
const HIGHLIGHT_COLORS = ["transparent", "#fef08a", "#fde68a", "#fed7aa", "#fbcfe8", "#bfdbfe", "#e5e7eb"];
const FONT_SIZES = [{ label: "S", value: "13px" }, { label: "M", value: "16px" }, { label: "L", value: "20px" }, { label: "XL", value: "28px" }];
const EMOJIS = ["😀","😁","😂","🤣","😊","😍","😎","🤔","👍","👏","🙏","🔥","✅","❌","⭐","💡","📌","📎","📝","📅","🎯","🚀","💬","❤️","⚠️","✨","👉","📣","🏆","🙌"];

function TBtn({ icon: Icon, title, active, onClick }: { icon: typeof Bold; title: string; active?: boolean; onClick: () => void }) {
  return (
    <SimpleTooltip label={title}>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); onClick(); }} className={cn("rounded p-1.5 transition-colors hover:bg-accent hover:text-foreground", active ? "bg-accent text-foreground" : "text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </button>
    </SimpleTooltip>
  );
}
const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" />;

// Lists use the plugin hooks (correct v53 toggling + selection handling).
function ListBtn({ nodeType, icon: Icon, title }: { nodeType: string; icon: typeof List; title: string }) {
  const state = useListToolbarButtonState({ nodeType });
  const btn: any = useListToolbarButton(state);
  const props = btn?.props ?? btn ?? {};
  return <SimpleTooltip label={title}><button type="button" {...props} className={cn("rounded p-1.5 transition-colors hover:bg-accent hover:text-foreground", props?.pressed ? "bg-accent text-foreground" : "text-muted-foreground")}><Icon className="h-4 w-4" /></button></SimpleTooltip>;
}
// Custom checkbox item: click toggles `checked` and strikes through the text.
// Document audio node: branded player with transcribe (inserts text below) + resizable width.
function AudioBlock(props: any) {
  const editor = useEditorRef();
  const path = usePath();
  const el = props.element ?? {};
  const insertTranscript = (text: string) => {
    try {
      const nodes = text.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => ({ type: "p", children: [{ text: l }] }));
      const at = [...path.slice(0, -1), (path[path.length - 1] ?? 0) + 1];
      (editor as any).tf?.insertNodes?.(nodes.length ? nodes : [{ type: "p", children: [{ text }] }], { at });
    } catch { /* no-op */ }
  };
  const setWidth = (w: number) => { try { (editor as any).tf?.setNodes?.({ width: w }, { at: path }); } catch { /* no-op */ } };
  return (
    <PlateElement {...props}>
      <div contentEditable={false} className="my-2">
        <BrandAudioPlayer src={el.url} onTranscript={insertTranscript} width={el.width} onWidthChange={setWidth} />
      </div>{props.children}
    </PlateElement>
  );
}

function TodoItem(props: any) {
  const editor = useEditorRef();
  const path = usePath();
  const checked = !!props.element?.checked;
  return (
    <PlateElement {...props} as="div" className="my-0.5 flex items-start gap-2">
      <span contentEditable={false} className="mt-1 shrink-0 select-none">
        <button
          type="button"
          onMouseDown={(ev) => { ev.preventDefault(); try { (editor as any).tf?.setNodes?.({ checked: !checked }, { at: path }); } catch { /* no-op */ } }}
          className={cn("flex h-4 w-4 items-center justify-center rounded border transition-colors", checked ? "border-accent bg-accent text-accent-foreground" : "border-input hover:border-accent")}
          aria-label={checked ? "Uncheck" : "Check"}
        >{checked ? <Check className="h-3 w-3" /> : null}</button>
      </span>
      <span className={cn("min-w-0 flex-1", checked && "text-muted-foreground line-through")}>{props.children}</span>
    </PlateElement>
  );
}

// Inline date field: click to pick a date; stored on the node.
function DateField(props: any) {
  const editor = useEditorRef();
  const path = usePath();
  const date = props.element?.date ?? "";
  return (
    <PlateElement {...props} as="span" className="mx-0.5 inline-block align-middle">
      <span contentEditable={false}>
        <DatePicker value={date} onChange={(v) => { try { (editor as any).tf?.setNodes?.({ date: v }, { at: path }); } catch { /* no-op */ } }} placeholder="Pick a date" className="h-7 w-auto min-w-[8.5rem] px-2 text-xs" />
      </span>
      {props.children}
    </PlateElement>
  );
}

// Inline swatch menu — buttons preventDefault so the editor selection is preserved.
function ColorMenu({ icon: Icon, title, colors, onPick }: { icon: typeof Baseline; title: string; colors: string[]; onPick: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <TBtn icon={Icon} title={title} onClick={() => setOpen((o) => !o)} />
      {open ? (
        <div className="absolute left-0 z-20 mt-1 flex gap-1 rounded-md border bg-popover p-2 shadow-md" onMouseDown={(e) => e.preventDefault()}>
          {colors.map((c) => (
            <button key={c} type="button" title={c} onMouseDown={(e) => { e.preventDefault(); onPick(c); setOpen(false); }} className="h-5 w-5 rounded border" style={{ background: c === "inherit" || c === "transparent" ? "linear-gradient(135deg,#fff 45%,#e11d48 45% 55%,#fff 55%)" : c }} />
          ))}
        </div>
      ) : null}
    </span>
  );
}

// Upload via the shared endpoint, then insert a media (void) node with the URL.
function MediaButton({ editor, actionToken, nodeType, accept, icon, title }: { editor: any; actionToken: string; nodeType: string; accept: string; icon: typeof ImageIcon; title: string }) {
  const ref = useRef<HTMLInputElement>(null);
  async function onPick(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("folder", "workspace");
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", headers: { "x-mjg-action-token": actionToken }, body: fd });
      const data = await res.json();
      if (res.ok && data.url) editor.tf?.insertNodes?.([{ type: nodeType, url: data.url, name: f.name, children: [{ text: "" }] }]);
    } catch { /* no-op */ }
  }
  return (
    <span>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
      <TBtn icon={icon} title={title} onClick={() => ref.current?.click()} />
    </span>
  );
}

type Cmd = { label: string; keywords?: string; icon: typeof Type; run: () => void };

// Self-contained insert menu (own search + keyboard nav). Opened by "/" on an empty
// line or the + button. It never inserts a slash node, so normal "/" typing is safe.
function CommandMenu({ open, pos, commands, onClose }: { open: boolean; pos: { top: number; left: number }; commands: Cmd[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  useEffect(() => { if (open) { setQ(""); setI(0); } }, [open]);
  const filtered = useMemo(() => commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [commands, q]);
  useEffect(() => { setI(0); }, [q]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.preventDefault(); onClose(); }} />
      <div className="fixed z-50 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md" style={{ top: pos.top, left: pos.left }} onMouseDown={(e) => e.preventDefault()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search blocks…"
          className="mb-1 w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, filtered.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); filtered[i]?.run(); onClose(); }
            else if (e.key === "Escape") { e.preventDefault(); onClose(); }
          }}
        />
        <ul className="max-h-64 overflow-y-auto">
          {filtered.length ? filtered.map((c, idx) => (
            <li key={c.label}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); c.run(); onClose(); }} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm", idx === i ? "bg-accent text-foreground" : "hover:bg-accent")}>
                <c.icon className="h-4 w-4 text-muted-foreground" /> {c.label}
              </button>
            </li>
          )) : <li className="px-2 py-2 text-xs text-muted-foreground">No matching blocks</li>}
        </ul>
      </div>
    </>
  );
}

// The "#" document-link picker: searchable, workspace-filterable, multi-column rows.
type LinkDoc = { id: string; title: string; owner_name: string | null; created_at: string; workspace_id: string | null; workspace_name: string | null };
const AVATAR_COLORS = ["#C9A46E", "#9B2F2E", "#5b7a8c", "#7c6f5a", "#8a6d3f", "#4b4844", "#2f6f5e"];
function initialsOf(name: string | null) { return (name || "?").split(" ").filter(Boolean).map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "?"; }

// Reliable caret position for popovers. A collapsed selection can yield a 0×0 rect
// (e.g. an empty line you just clicked into) — fall back to the containing element.
function caretPos(width = 320): { top: number; left: number } {
  if (typeof window === "undefined") return { top: 220, left: 240 };
  const sel = window.getSelection();
  let rect: DOMRect | null = null;
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    const r = range.getBoundingClientRect();
    if (r && (r.width || r.height || r.top || r.left)) rect = r;
    else {
      const rects = range.getClientRects();
      if (rects.length) rect = rects[0];
      else {
        const node = range.startContainer;
        const elx = node.nodeType === 3 ? node.parentElement : (node as Element);
        if (elx) rect = elx.getBoundingClientRect();
      }
    }
  }
  if (!rect) return { top: 220, left: 240 };
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = Math.min(rect.bottom + 4, window.innerHeight - 320);
  return { top, left };
}
function DocLinkMenu({ pos, onClose, onPick, onTab }: { pos: { top: number; left: number }; onClose: () => void; onPick: (d: LinkDoc) => void; onTab: () => void }) {
  const [q, setQ] = useState("");
  const [ws, setWs] = useState("all");
  const [wsOpen, setWsOpen] = useState(false);
  const [docs, setDocs] = useState<LinkDoc[]>([]);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);
  const currentWsName = ws === "all" ? "All spaces" : (workspaces.find((w) => w.id === ws)?.name ?? "All spaces");
  useEffect(() => {
    let ok = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (ws !== "all") params.set("ws", ws);
        const res = await fetch(`/api/workspace/doc-links?${params.toString()}`);
        const d = await res.json();
        if (ok && d.ok) { setDocs(d.docs); setWorkspaces(d.workspaces ?? []); }
      } finally { if (ok) setLoading(false); }
    }, 180);
    return () => { ok = false; clearTimeout(t); };
  }, [q, ws]);
  useEffect(() => setI(0), [docs]);
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.preventDefault(); onClose(); }} />
      <div className="fixed z-50 w-80 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" style={{ top: pos.top, left: pos.left }} onMouseDown={(e) => e.preventDefault()}>
        <div className="flex items-center gap-1 p-1">
          <SearchIcon className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, docs.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (docs[i]) onPick(docs[i]); }
              else if (e.key === "Tab") { e.preventDefault(); onTab(); }
              else if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
            placeholder="Link a document…" className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          />
          {/* Custom (click-based) filter — a native <select> is blocked by the popover's mousedown preventDefault. */}
          <div className="relative shrink-0">
            <button type="button" onClick={() => setWsOpen((o) => !o)} className="flex max-w-[8rem] items-center gap-1 rounded border bg-background px-2 py-1 text-xs hover:bg-accent">
              <span className="truncate">{currentWsName}</span><ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </button>
            {wsOpen ? (
              <div className="absolute right-0 top-full z-[60] mt-1 max-h-48 w-44 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                <button type="button" onClick={() => { setWs("all"); setWsOpen(false); }} className={cn("block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent", ws === "all" && "bg-accent")}>All spaces</button>
                {workspaces.map((w) => <button key={w.id} type="button" onClick={() => { setWs(w.id); setWsOpen(false); }} className={cn("block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent", ws === w.id && "bg-accent")}>{w.name}</button>)}
              </div>
            ) : null}
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {loading ? <p className="px-2 py-3 text-center text-xs text-muted-foreground">Loading…</p>
            : docs.length ? docs.map((d, idx) => (
              <button key={d.id} type="button" onMouseEnter={() => setI(idx)} onClick={() => onPick(d)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left", i === idx ? "bg-accent" : "")}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: AVATAR_COLORS[initialsOf(d.owner_name).charCodeAt(0) % AVATAR_COLORS.length] }}>{initialsOf(d.owner_name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{d.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{d.owner_name ?? "—"} · {new Date(d.created_at).toLocaleDateString()}{d.workspace_name ? ` · ${d.workspace_name}` : ""}</span>
                </span>
              </button>
            )) : <p className="px-2 py-3 text-center text-xs text-muted-foreground">No documents found. Press Tab to keep the “#”.</p>}
        </div>
      </div>
    </>
  );
}

// Record audio in-browser, then upload + hand back a URL to insert as an audio block.
function RecorderDialog({ open, onOpenChange, actionToken, onInsert, onTranscript }: { open: boolean; onOpenChange: (v: boolean) => void; actionToken: string; onInsert: (url: string) => void; onTranscript: (text: string) => void }) {
  const [status, setStatus] = useState<"idle" | "recording" | "recorded" | "uploading" | "transcribing">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mr = useRef<any>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);

  function reset() { setStatus("idle"); setPreviewUrl(null); setError(null); blob.current = null; chunks.current = []; }

  async function transcribe() {
    if (!blob.current) return;
    setStatus("transcribing"); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob.current], `recording-${Date.now()}.webm`, { type: "audio/webm" }));
      const res = await fetch("/api/workspace/transcribe", { method: "POST", headers: { "x-mjg-action-token": actionToken }, body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Transcription failed."); setStatus("recorded"); return; }
      if (data.text) onTranscript(data.text);
      onOpenChange(false); reset();
    } catch { setError("Transcription failed. Please try again."); setStatus("recorded"); }
  }
  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new (window as any).MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e: any) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => { const b = new Blob(chunks.current, { type: "audio/webm" }); blob.current = b; setPreviewUrl(URL.createObjectURL(b)); setStatus("recorded"); stream.getTracks().forEach((t: any) => t.stop()); };
      mr.current = rec; rec.start(); setStatus("recording");
    } catch { setStatus("idle"); }
  }
  function stop() { try { mr.current?.stop(); } catch { /* no-op */ } }
  async function insert() {
    if (!blob.current) return;
    setStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("file", new File([blob.current], `recording-${Date.now()}.webm`, { type: "audio/webm" }));
      fd.append("folder", "workspace");
      const res = await fetch("/api/admin/uploads", { method: "POST", headers: { "x-mjg-action-token": actionToken }, body: fd });
      const data = await res.json();
      if (res.ok && data.url) { onInsert(data.url); onOpenChange(false); reset(); } else setStatus("recorded");
    } catch { setStatus("recorded"); }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record audio</DialogTitle><DialogDescription>Record a voice note, then insert the audio or transcribe it to text.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {status === "recording" ? (
              <Button variant="destructive" onClick={stop}>■ Stop</Button>
            ) : (
              <Button onClick={start} disabled={status === "uploading" || status === "transcribing"}><Mic className="mr-2 h-4 w-4" /> {status === "recorded" ? "Re-record" : "Record"}</Button>
            )}
            {status === "recording" ? <span className="text-sm text-muted-foreground">Recording…</span> : null}
            {status === "transcribing" ? <span className="text-sm text-muted-foreground">Transcribing…</span> : null}
          </div>
          {previewUrl ? <audio controls src={previewUrl} className="w-full" /> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button variant="outline" onClick={transcribe} disabled={!blob.current || status === "uploading" || status === "transcribing"}><FileText className="mr-2 h-4 w-4" /> {status === "transcribing" ? "Transcribing…" : "Transcribe to text"}</Button>
          <Button onClick={insert} disabled={!blob.current || status === "uploading" || status === "transcribing"}>{status === "uploading" ? "Inserting…" : "Insert audio"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HtmlEmbedDialog({ open, onOpenChange, onInsert }: { open: boolean; onOpenChange: (v: boolean) => void; onInsert: (html: string) => void }) {
  const [html, setHtml] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setHtml(""); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>HTML embed</DialogTitle><DialogDescription>Paste HTML to render it in the document (scripts are disabled for safety).</DialogDescription></DialogHeader>
        <Textarea rows={8} value={html} onChange={(e) => setHtml(e.target.value)} placeholder="<div>…</div>" className="font-mono text-xs" />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setHtml(""); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={() => { if (html.trim()) { onInsert(html); setHtml(""); onOpenChange(false); } }} disabled={!html.trim()}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPickerDialog({ open, onOpenChange, onInsert }: { open: boolean; onOpenChange: (v: boolean) => void; onInsert: (r: any) => void }) {
  const [type, setType] = useState("plan");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try { const res = await fetch(`/api/workspace/records?type=${type}&q=${encodeURIComponent(q)}`); const data = await res.json(); setResults(res.ok ? data.results : []); } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [open, type, q]);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setQ(""); setResults([]); } onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Link a record</DialogTitle><DialogDescription>Insert a live card linking this document to a CMI record.</DialogDescription></DialogHeader>
        <div className="flex gap-2">
          <Select value={type} onValueChange={(v) => { setType(v); setResults([]); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="plan">Project</SelectItem><SelectItem value="participant">Client</SelectItem><SelectItem value="booking">Booking</SelectItem></SelectContent>
          </Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
        </div>
        <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
          {results.length ? results.map((r) => (
            <li key={`${r.recordType}-${r.recordId}`}>
              <button type="button" onClick={() => { onInsert(r); onOpenChange(false); setQ(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent">
                <span className="truncate font-medium">{r.label}</span>{r.sublabel ? <span className="shrink-0 text-xs text-muted-foreground">{r.sublabel}</span> : null}
              </button>
            </li>
          )) : <li className="px-3 py-4 text-center text-xs text-muted-foreground">No records found.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

const AI_ACTIONS = [
  { value: "summarize", label: "Summarize" },
  { value: "action_items", label: "Extract action items" },
  { value: "improve", label: "Improve writing" },
  { value: "shorten", label: "Shorten" },
  { value: "expand", label: "Expand" },
];
function AiDialog({ open, onOpenChange, getText, onInsert }: { open: boolean; onOpenChange: (v: boolean) => void; getText: () => string; onInsert: (t: string) => void }) {
  const actionToken = useDashboardActionToken();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(opts: { action?: string; prompt?: string }) {
    setBusy(true); setError(null); setResult("");
    try {
      const body: Record<string, unknown> = { actionToken, text: getText() };
      if (opts.prompt) body.prompt = opts.prompt; else body.action = opts.action ?? "summarize";
      const res = await fetch("/api/workspace/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "AI failed."); else setResult(data.result || "");
    } catch { setError("AI request failed."); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setResult(""); setError(null); setPrompt(""); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> AI assistant</DialogTitle><DialogDescription>Ask anything or give an instruction — the assistant uses this document as context. Review the result before inserting.</DialogDescription></DialogHeader>
        <Textarea
          value={prompt}
          onChange={(ev) => setPrompt(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && prompt.trim() && !busy) { ev.preventDefault(); run({ prompt: prompt.trim() }); } }}
          rows={3}
          placeholder="e.g. “Draft a meeting agenda from these notes”, “List the risks and next steps”, or “Rewrite this in a warmer tone.”  (⌘/Ctrl+Enter to run)"
          className="text-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-muted-foreground">Quick actions:</span>
          {AI_ACTIONS.map((a) => (
            <button key={a.value} type="button" onClick={() => run({ action: a.value })} disabled={busy} className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-50">{a.label}</button>
          ))}
          <Button size="sm" className="ml-auto" onClick={() => run({ prompt: prompt.trim() })} disabled={busy || !prompt.trim()}>{busy ? "Working…" : "Run"}</Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {result ? <Textarea readOnly value={result} rows={10} className="text-sm" /> : null}
        {result ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(result); }}>Copy</Button>
            <Button onClick={() => { onInsert(result); onOpenChange(false); setResult(""); }}>Insert into document</Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Live outline built from the document's H1–H3 headings; clicking scrolls to the heading.
function OutlineNav({ editor }: { editor: any }) {
  const items: { i: number; lvl: number; text: string }[] = [];
  (editor.children ?? []).forEach((n: any, i: number) => {
    const lvl = n?.type === H1Plugin.key ? 1 : n?.type === H2Plugin.key ? 2 : n?.type === H3Plugin.key ? 3 : 0;
    if (lvl) items.push({ i, lvl, text: (n.children ?? []).map((c: any) => c?.text ?? "").join("").trim() || "Untitled heading" });
  });
  const go = (i: number) => { try { const dom = editor.api?.toDOMNode?.(editor.children[i]); dom?.scrollIntoView?.({ behavior: "smooth", block: "start" }); } catch { /* no-op */ } };
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outline</p>
      {items.length ? (
        <ul className="space-y-0.5">
          {items.map((it) => (
            <li key={it.i}>
              <button type="button" onMouseDown={(ev) => { ev.preventDefault(); go(it.i); }} className={cn("block w-full truncate rounded px-2 py-1 text-left text-sm transition-colors hover:bg-accent", it.lvl === 1 ? "font-medium" : it.lvl === 2 ? "pl-4 text-muted-foreground" : "pl-6 text-muted-foreground")}>{it.text}</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted-foreground">Add headings (H1–H3) to build an outline.</p>}
    </div>
  );
}

// In-document find & replace. Operates on text leaves; re-scans on each replace so paths stay valid.
function FindReplaceDialog({ open, onOpenChange, editor }: { open: boolean; onOpenChange: (v: boolean) => void; editor: any }) {
  const [find, setFind] = useState("");
  const [repl, setRepl] = useState("");
  const [count, setCount] = useState<number | null>(null);

  function leaves(nodes: any[], base: number[] = []): { path: number[]; text: string }[] {
    const out: { path: number[]; text: string }[] = [];
    (nodes ?? []).forEach((n, i) => {
      const p = [...base, i];
      if (typeof n?.text === "string") out.push({ path: p, text: n.text });
      else if (Array.isArray(n?.children)) out.push(...leaves(n.children, p));
    });
    return out;
  }
  function countMatches(term: string) {
    if (!term) { setCount(null); return; }
    let c = 0;
    for (const l of leaves(editor.children)) { let idx = 0; for (;;) { const k = l.text.indexOf(term, idx); if (k < 0) break; c++; idx = k + term.length; } }
    setCount(c);
  }
  function replaceOnce(): boolean {
    if (!find) return false;
    for (const l of leaves(editor.children)) {
      const k = l.text.indexOf(find);
      if (k >= 0) {
        try { editor.tf?.insertText?.(repl, { at: { anchor: { path: l.path, offset: k }, focus: { path: l.path, offset: k + find.length } } }); } catch { /* no-op */ }
        return true;
      }
    }
    return false;
  }
  function replaceAll() { let n = 0; while (n < 5000 && replaceOnce()) n++; countMatches(find); }
  function findFirst() {
    if (!find) return;
    for (const l of leaves(editor.children)) {
      const k = l.text.indexOf(find);
      if (k >= 0) { try { editor.tf?.select?.({ anchor: { path: l.path, offset: k }, focus: { path: l.path, offset: k + find.length } }); editor.tf?.focus?.(); } catch { /* no-op */ } break; }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setCount(null); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><SearchIcon className="h-4 w-4" /> Find &amp; Replace</DialogTitle><DialogDescription>Search the document and replace matches.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <Input value={find} onChange={(ev) => { setFind(ev.target.value); countMatches(ev.target.value); }} placeholder="Find…" />
          <Input value={repl} onChange={(ev) => setRepl(ev.target.value)} placeholder="Replace with…" />
          {count !== null ? <p className="text-xs text-muted-foreground">{count} match{count === 1 ? "" : "es"}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={findFirst} disabled={!find}>Find</Button>
          <Button variant="outline" onClick={() => { replaceOnce(); countMatches(find); }} disabled={!find}>Replace</Button>
          <Button onClick={replaceAll} disabled={!find}>Replace all</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TableInsertDialog({ open, onOpenChange, onInsert }: { open: boolean; onOpenChange: (v: boolean) => void; onInsert: (rows: number, cols: number) => void }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const clamp = (n: number, max: number) => Math.max(1, Math.min(max, Math.round(n || 1)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><TableIcon className="h-4 w-4" /> Insert table</DialogTitle><DialogDescription>Choose how many rows and columns.</DialogDescription></DialogHeader>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5"><label className="text-xs font-medium">Rows</label><Input type="number" min={1} max={30} value={rows} onChange={(ev) => setRows(Number(ev.target.value))} /></div>
          <div className="flex-1 space-y-1.5"><label className="text-xs font-medium">Columns</label><Input type="number" min={1} max={12} value={cols} onChange={(ev) => setCols(Number(ev.target.value))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onInsert(clamp(rows, 30), clamp(cols, 12)); onOpenChange(false); }}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TableSettingsDialog({ open, onOpenChange, setTableProps, setCellBackground }: { open: boolean; onOpenChange: (v: boolean) => void; setTableProps: (p: Record<string, unknown>) => void; setCellBackground: (c: string | null) => void }) {
  const BORDER_W = [{ label: "None", v: 0 }, { label: "Thin", v: 1 }, { label: "Medium", v: 2 }, { label: "Thick", v: 3 }];
  const BORDER_C = ["var(--border)", "#111827", "#6b7280", "var(--accent)", "#dc2626", "#2563eb", "#16a34a"];
  const BG_C: (string | null)[] = [null, "var(--muted)", "rgb(201 164 110 / 0.12)", "#fef9c3", "#dcfce7", "#dbeafe", "#fee2e2", "#f3e8ff"];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Table settings</DialogTitle><DialogDescription>Applies to the table your cursor is in.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium">Border thickness</p>
            <div className="flex gap-1.5">{BORDER_W.map((b) => <button key={b.v} type="button" onClick={() => setTableProps({ borderWidth: b.v })} className="rounded border px-2.5 py-1 text-xs transition-colors hover:bg-accent">{b.label}</button>)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium">Border color</p>
            <div className="flex flex-wrap gap-1.5">{BORDER_C.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setTableProps({ borderColor: c })} className="h-6 w-6 rounded border" style={{ background: c }} />)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium">Cell background <span className="font-normal text-muted-foreground">(current cell)</span></p>
            <div className="flex flex-wrap gap-1.5">{BG_C.map((c, i) => <button key={i} type="button" aria-label={c ?? "none"} onClick={() => setCellBackground(c)} className="flex h-6 w-6 items-center justify-center rounded border text-[10px] text-muted-foreground" style={{ background: c ?? "transparent" }}>{c === null ? "✕" : ""}</button>)}</div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Branded link input anchored near the selection (replaces the browser's window.prompt).
function LinkPopover({ pop, onApply, onClose }: { pop: { top: number; left: number; sel: boolean } | null; onApply: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (pop) setUrl(""); }, [pop]);
  if (!pop) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.preventDefault(); onClose(); }} />
      <div style={{ position: "fixed", top: pop.top, left: pop.left, width: 288 }} className="z-50 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <Link2 className="h-4 w-4 shrink-0 text-accent" />
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onApply(url); } if (e.key === "Escape") onClose(); }}
            placeholder="Paste a link (https://…)"
            className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); onApply(url); }} className="h-8 shrink-0 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">Apply</button>
        </div>
        <p className="mt-1 px-1 text-[11px] text-muted-foreground">{pop.sel ? "Links the selected text." : "Inserts the link."}</p>
      </div>
    </>
  );
}

// A large "live app" card for the Insert mega-menu (icon + mini infographic + blurb).
function InsertMegaCard({ onSelect, icon: Icon, title, desc, accent, children }: { onSelect: () => void; icon: any; title: string; desc: string; accent: string; children: React.ReactNode }) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="flex h-auto flex-col items-stretch gap-2 rounded-lg border p-2.5 transition-colors hover:border-accent/50 data-[highlighted]:border-accent/60 data-[highlighted]:bg-accent/40">
      <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: accent }}><Icon className="h-4 w-4" /> {title}</span>
      <span className="block rounded-md border bg-muted/40 p-2">{children}</span>
      <span className="text-xs font-normal text-muted-foreground">{desc}</span>
    </DropdownMenuItem>
  );
}

// Read-only render of Plate content — used to preview a template without creating a document.
export function WorkspaceReadOnlyPreview({ value }: { value: any }) {
  const initial = useMemo(() => (Array.isArray(value) && value.length ? value : [{ type: "p", children: [{ text: "" }] }]), [value]);
  const editor = usePlateEditor({ plugins: PLUGINS, components: COMPONENTS, value: initial });
  return (
    <Plate editor={editor}>
      <div className="pointer-events-none select-none [&_*]:cursor-default">
        <PlateContent readOnly className="rounded-md border bg-background px-4 py-3 text-[15px] leading-7 [&_p]:my-1.5" />
      </div>
    </Plate>
  );
}

export function WorkspaceEditorSurface({
  initialValue, onChange, titleSlot, statusSlot, left, right, mentionUsers = [],
}: {
  initialValue: any;
  onChange: (value: any) => void;
  titleSlot?: React.ReactNode;
  statusSlot?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  mentionUsers?: { id: string; name: string }[];
}) {
  const value = useMemo(() => (Array.isArray(initialValue) && initialValue.length ? initialValue : [{ type: "p", children: [{ text: "" }] }]), [initialValue]);
  const editor = usePlateEditor({ plugins: PLUGINS, components: COMPONENTS, value });
  const actionToken = useDashboardActionToken();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [sizeOpen, setSizeOpen] = useState(false);

  const toggle = (key: string) => { try { (editor.tf as any)?.[key]?.toggle?.(); } catch { /* no-op */ } };
  const setMark = (key: string, val: string) => { try { (editor.tf as any)?.addMark?.(key, val); } catch { /* no-op */ } };
  const setAlign = (val: string) => { try { (editor.tf as any)?.setNodes?.({ [TextAlignPlugin.key]: val }, { match: (n: any) => !!n?.type }); } catch { /* no-op */ } };
  const e = editor as any;
  const doInsertLink = () => {
    // Open a branded popover anchored to the selection (replaces window.prompt).
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const hasSelection = !!sel && !sel.isCollapsed && sel.toString().length > 0;
    const rect = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    const top = (rect?.bottom ?? 220) + 6;
    const left = Math.max(8, Math.min(rect?.left ?? 240, (typeof window !== "undefined" ? window.innerWidth : 900) - 300));
    setLinkPop({ top, left, sel: hasSelection });
  };
  const applyLink = (url: string) => {
    const clean = url.trim();
    if (clean) { try { if (linkPop?.sel) upsertLink(e, { url: clean }); else insertLink(e, { url: clean, text: clean }); } catch { /* no-op */ } }
    setLinkPop(null);
  };
  const insertTableSized = (rows: number, cols: number) => { try { insertTable(e, { rowCount: rows, colCount: cols }); } catch { /* no-op */ } };
  const setTableProps = (props: Record<string, unknown>) => { if (!e.selection) return; try { e.tf?.setNodes?.(props, { match: (n: any) => n?.type === TablePlugin.key, at: e.selection }); } catch { /* no-op */ } };
  const setCellBackground = (background: string | null) => { if (!e.selection) return; try { e.tf?.setNodes?.({ background }, { match: (n: any) => n?.type === TableCellPlugin.key || n?.type === TableCellHeaderPlugin.key, at: e.selection }); } catch { /* no-op */ } };
  const doAddRow = () => { try { insertTableRow(e); } catch { /* no-op */ } };
  const doAddCol = () => { try { insertTableColumn(e); } catch { /* no-op */ } };
  const doDeleteTable = () => { try { deleteTable(e); } catch { /* no-op */ } };
  const insertCodeBlock = () => { try { e.tf?.insertNodes?.({ type: CodeBlockPlugin.key, children: [{ type: CodeLinePlugin.key, children: [{ text: "" }] }] }); } catch { /* no-op */ } };
  const insertDivider = () => { try { e.tf?.insertNodes?.({ type: HorizontalRulePlugin.key, children: [{ text: "" }] }); } catch { /* no-op */ } };
  const insertColumns = () => { try { insertColumnGroup(e, { columns: 2 }); } catch { /* no-op */ } };
  const insertHtml = (html: string) => { try { e.tf?.insertNodes?.({ type: HtmlEmbedPlugin.key, html, children: [{ text: "" }] }); } catch { /* no-op */ } };
  const insertRecordedAudio = (url: string) => { try { e.tf?.insertNodes?.({ type: AudioPlugin.key, url, children: [{ text: "" }] }); } catch { /* no-op */ } };
  const insertToc = () => { try { e.tf?.insertNodes?.({ type: TocPlugin.key, children: [{ text: "" }] }); } catch { /* no-op */ } };
  const makeTodo = () => { try { e.tf?.setNodes?.({ type: TodoItemPlugin.key, checked: false }, { match: (n: any) => !!n?.type && !("text" in n), mode: "lowest" }); } catch { /* no-op */ } };
  const insertDate = () => { try { e.tf?.insertNodes?.({ type: DateFieldPlugin.key, date: null, children: [{ text: "" }] }); } catch { /* no-op */ } };
  const insertRecordLink = (r: any) => { try { e.tf?.insertNodes?.({ type: RecordLinkPlugin.key, recordType: r.recordType, recordId: r.recordId, label: r.label, sublabel: r.sublabel, href: r.href, children: [{ text: "" }] }); } catch { /* no-op */ } };
  const insertDocLink = (d: any) => { try { e.tf?.insertNodes?.({ type: DocLinkPlugin.key, docId: d.id, title: d.title, href: `/dashboard/workspace/${d.id}`, children: [{ text: "" }] }); } catch { /* no-op */ } };
  const insertText = (t: string) => { try { e.tf?.insertText?.(t); } catch { /* no-op */ } };
  const insertProjectTracker = () => { try { e.tf?.insertNodes?.(newProjectTrackerNode()); } catch { /* no-op */ } };
  const insertKanban = () => { try { e.tf?.insertNodes?.(newKanbanNode()); } catch { /* no-op */ } };
  const insertCalendar = () => { try { e.tf?.insertNodes?.(newCalendarNode()); } catch { /* no-op */ } };
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [linkPop, setLinkPop] = useState<{ top: number; left: number; sel: boolean } | null>(null);
  const [tableInsertOpen, setTableInsertOpen] = useState(false);
  const [tableSettingsOpen, setTableSettingsOpen] = useState(false);
  const doInsertTable = () => setTableInsertOpen(true);
  const [, setTick] = useState(0);
  const doUndo = () => { try { e.undo?.(); } catch { /* no-op */ } };
  const doRedo = () => { try { e.redo?.(); } catch { /* no-op */ } };
  const MARK_KEYS = [BoldPlugin.key, ItalicPlugin.key, UnderlinePlugin.key, StrikethroughPlugin.key, CodePlugin.key, HighlightPlugin.key, FontColorPlugin.key, FontBackgroundColorPlugin.key, FontSizePlugin.key];
  const clearFormatting = () => { try { for (const k of MARK_KEYS) e.tf?.removeMark?.(k); } catch { /* no-op */ } };
  const focusMode = () => { setLeftOpen(false); setRightOpen(false); setOutlineOpen(false); };
  const uploadMedia = (nodeType: string, accept: string) => {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      const fd = new FormData(); fd.append("file", f); fd.append("folder", "workspace");
      try {
        const res = await fetch("/api/admin/uploads", { method: "POST", headers: { "x-mjg-action-token": actionToken }, body: fd });
        const data = await res.json();
        if (res.ok && data.url) e.tf?.insertNodes?.([{ type: nodeType, url: data.url, name: f.name, children: [{ text: "" }] }]);
      } catch { /* no-op */ }
    };
    input.click();
  };
  const getDocText = () => { try { return extractPlainText((editor as any).children ?? []); } catch { return ""; } };
  const insertAiText = (txt: string) => {
    try {
      const nodes = txt.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => ({ type: "p", children: [{ text: l }] }));
      e.tf?.insertNodes?.(nodes.length ? nodes : [{ type: "p", children: [{ text: txt }] }]);
    } catch { /* no-op */ }
  };

  const [docLinkPos, setDocLinkPos] = useState<{ top: number; left: number } | null>(null);
  const [menu, setMenu] = useState<{ open: boolean; top: number; left: number; cmds: Cmd[] }>({ open: false, top: 0, left: 0, cmds: [] });
  const openMenu = (top: number, left: number, cmds: Cmd[]) => setMenu({ open: true, top, left, cmds });
  const closeMenu = () => setMenu((m) => ({ ...m, open: false }));
  const list = (listStyleType: string) => { try { toggleList(editor as any, { listStyleType } as any); } catch { /* no-op */ } };
  const commands: Cmd[] = [
    { label: "Text", keywords: "paragraph body", icon: Type, run: () => { try { (editor.tf as any)?.setNodes?.({ type: "p" }, { match: (n: any) => !!n?.type }); } catch { /* no-op */ } } },
    { label: "Heading 1", keywords: "h1 title", icon: Heading1, run: () => toggle(H1Plugin.key) },
    { label: "Heading 2", keywords: "h2", icon: Heading2, run: () => toggle(H2Plugin.key) },
    { label: "Heading 3", keywords: "h3", icon: Heading3, run: () => toggle(H3Plugin.key) },
    { label: "Bulleted list", keywords: "ul unordered", icon: List, run: () => list("disc") },
    { label: "Numbered list", keywords: "ol ordered", icon: ListOrdered, run: () => list("decimal") },
    { label: "Checklist", keywords: "todo task checkbox", icon: CheckSquare, run: makeTodo },
    { label: "Date", keywords: "date calendar deadline due", icon: CalendarDays, run: insertDate },
    { label: "Quote", keywords: "blockquote", icon: Quote, run: () => toggle(BlockquotePlugin.key) },
    { label: "Code block", keywords: "code snippet", icon: SquareCode, run: insertCodeBlock },
    { label: "Table", keywords: "grid", icon: TableIcon, run: doInsertTable },
    { label: "Table of contents", keywords: "toc outline headings", icon: ListTree, run: insertToc },
    { label: "Project Tracker", keywords: "project tracker table plan owner status deadline", icon: FolderKanban, run: insertProjectTracker },
    { label: "Kanban Board", keywords: "kanban board columns cards", icon: SquareKanban, run: insertKanban },
    { label: "Calendar", keywords: "calendar events schedule month", icon: CalendarRange, run: insertCalendar },
    { label: "Ask AI", keywords: "ai summarize rewrite improve action items assistant", icon: Sparkles, run: () => setAiOpen(true) },
    { label: "Link a document", keywords: "hash document link reference workspace", icon: Hash, run: () => setDocLinkPos(caretPos()) },
    { label: "Link a record", keywords: "plan client booking record link mjg", icon: Boxes, run: () => setRecordOpen(true) },
    { label: "Columns", keywords: "layout two column split", icon: Columns2, run: insertColumns },
    { label: "HTML embed", keywords: "html iframe render", icon: FileCode2, run: () => setHtmlOpen(true) },
    { label: "Record audio", keywords: "voice mic recorder", icon: Mic, run: () => setRecorderOpen(true) },
    { label: "Emoji", keywords: "emoji icon smiley", icon: Smile, run: () => setEmojiOpen(true) },
    { label: "Divider", keywords: "hr line separator", icon: Minus, run: insertDivider },
  ];
  const mentionCommands: Cmd[] = mentionUsers.map((u) => ({ label: `@${u.name}`, keywords: u.name, icon: AtSign, run: () => insertText(`@${u.name} `) }));

  return (
    <Plate editor={editor} onChange={({ value }: any) => { onChange(value); setTick((t) => t + 1); }}>
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-0.5 rounded-md border bg-card p-1 shadow-sm">
        <TBtn icon={leftOpen ? PanelLeftClose : PanelLeftOpen} title={leftOpen ? "Hide files" : "Show files"} onClick={() => setLeftOpen((o) => !o)} />
        <Sep />
        {/* Quip-style menus — alternative access points for actions also on the toolbar. */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[state=open]:bg-accent data-[state=open]:text-foreground">Edit<ChevronDown className="h-3 w-3 opacity-60" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={doUndo}><Undo2 /> Undo <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem onSelect={doRedo}><Redo2 /> Redo <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setFindOpen(true)}><SearchIcon /> Find &amp; Replace <DropdownMenuShortcut>Ctrl+H</DropdownMenuShortcut></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[state=open]:bg-accent data-[state=open]:text-foreground">View<ChevronDown className="h-3 w-3 opacity-60" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem checked={leftOpen} onCheckedChange={(v) => setLeftOpen(!!v)}>Show files</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={rightOpen} onCheckedChange={(v) => setRightOpen(!!v)}>Show comments</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={outlineOpen} onCheckedChange={(v) => setOutlineOpen(!!v)}>Show outline</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={focusMode}><Maximize2 /> Focus mode</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[state=open]:bg-accent data-[state=open]:text-foreground">Insert<ChevronDown className="h-3 w-3 opacity-60" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[80vh] w-[560px] overflow-y-auto">
            <DropdownMenuLabel>Building blocks</DropdownMenuLabel>
            <div className="grid grid-cols-3 gap-2 p-1">
              {/* MJG brand: Ink (theme-aware) for Project Tracker, Gold for Kanban, Red for Calendar — each stepped. */}
              <InsertMegaCard onSelect={insertProjectTracker} icon={FolderKanban} title="Project Tracker" accent="var(--foreground)" desc="Assign owners, statuses, deadlines & files.">
                <span className="block space-y-1">
                  <span className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className="h-1.5 rounded-full" style={{ background: "var(--foreground)" }} />)}</span>
                  {[0, 1, 2].map((r) => <span key={r} className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className="h-2 rounded" style={{ background: "rgb(120 111 90 / 0.25)" }} />)}</span>)}
                </span>
              </InsertMegaCard>
              <InsertMegaCard onSelect={insertKanban} icon={SquareKanban} title="Kanban Board" accent="#C9A46E" desc="Cards & columns to track progress.">
                <span className="grid grid-cols-3 gap-1.5">{["#C9A46E", "#C9A46EB3", "#C9A46E80"].map((c, i) => (
                  <span key={i} className="block h-14 rounded-md" style={{ background: c }} />
                ))}</span>
              </InsertMegaCard>
              <InsertMegaCard onSelect={insertCalendar} icon={CalendarRange} title="Calendar" accent="#9B2F2E" desc="Plan events & schedules by month.">
                <span className="grid grid-cols-7 gap-0.5">{Array.from({ length: 21 }).map((_, i) => <span key={i} className="block aspect-square rounded" style={{ background: i === 10 ? "#9B2F2E" : "#9B2F2E80" }} />)}</span>
              </InsertMegaCard>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Media</DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-0.5">
              <DropdownMenuItem onSelect={() => uploadMedia(ImagePlugin.key, "image/*")}><ImageIcon /> Image</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => uploadMedia(VideoPlugin.key, "video/*")}><Video /> Video</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => uploadMedia(AudioPlugin.key, "audio/*")}><Music /> Audio</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => uploadMedia(FilePlugin.key, "application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv")}><Paperclip /> Document</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRecorderOpen(true)}><Mic /> Record audio</DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Basic</DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-0.5">
              <DropdownMenuItem onSelect={doInsertTable}><TableIcon /> Table</DropdownMenuItem>
              <DropdownMenuItem onSelect={makeTodo}><CheckSquare /> Checklist</DropdownMenuItem>
              <DropdownMenuItem onSelect={insertDate}><CalendarDays /> Date</DropdownMenuItem>
              <DropdownMenuItem onSelect={insertColumns}><Columns2 /> Columns</DropdownMenuItem>
              <DropdownMenuItem onSelect={insertToc}><ListTree /> Table of contents</DropdownMenuItem>
              <DropdownMenuItem onSelect={insertDivider}><Minus /> Divider</DropdownMenuItem>
              <DropdownMenuItem onSelect={doInsertLink}><Link2 /> Link</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRecordOpen(true)}><Boxes /> Link a record</DropdownMenuItem>
              <DropdownMenuItem onSelect={insertCodeBlock}><SquareCode /> Code block</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setHtmlOpen(true)}><FileCode2 /> HTML embed</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEmojiOpen(true)}><Smile /> Emoji</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAiOpen(true)}><Sparkles /> Ask AI</DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[state=open]:bg-accent data-[state=open]:text-foreground">Format<ChevronDown className="h-3 w-3 opacity-60" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => toggle(BoldPlugin.key)}><Bold /> Bold <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggle(ItalicPlugin.key)}><Italic /> Italic <DropdownMenuShortcut>Ctrl+I</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggle(UnderlinePlugin.key)}><Underline /> Underline <DropdownMenuShortcut>Ctrl+U</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggle(StrikethroughPlugin.key)}><Strikethrough /> Strikethrough</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggle(HighlightPlugin.key)}><Highlighter /> Highlight</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggle(CodePlugin.key)}><Code /> Inline code</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Pilcrow className="mr-2 h-4 w-4" /> Paragraph style</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => { try { (editor.tf as any)?.setNodes?.({ type: "p" }, { match: (n: any) => !!n?.type }); } catch { /* no-op */ } }}><Type /> Text</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggle(H1Plugin.key)}><Heading1 /> Heading 1</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggle(H2Plugin.key)}><Heading2 /> Heading 2</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggle(H3Plugin.key)}><Heading3 /> Heading 3</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggle(BlockquotePlugin.key)}><Quote /> Quote</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><AlignLeft className="mr-2 h-4 w-4" /> Alignment</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => setAlign("left")}><AlignLeft /> Left</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAlign("center")}><AlignCenter /> Center</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAlign("right")}><AlignRight /> Right</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><List className="mr-2 h-4 w-4" /> List</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => list("disc")}><List /> Bulleted list</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => list("decimal")}><ListOrdered /> Numbered list</DropdownMenuItem>
                <DropdownMenuItem onSelect={makeTodo}><CheckSquare /> Checklist</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={clearFormatting}><RemoveFormatting /> Clear formatting <DropdownMenuShortcut>Ctrl+\</DropdownMenuShortcut></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Sep />
        <SimpleTooltip label="Insert block">
          <button type="button" onMouseDown={(ev) => { ev.preventDefault(); const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(r.bottom + 4, r.left, commands); }} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Plus className="h-4 w-4" /></button>
        </SimpleTooltip>
        <Sep />
        <TBtn icon={Bold} title="Bold" onClick={() => toggle(BoldPlugin.key)} />
        <TBtn icon={Italic} title="Italic" onClick={() => toggle(ItalicPlugin.key)} />
        <TBtn icon={Underline} title="Underline" onClick={() => toggle(UnderlinePlugin.key)} />
        <TBtn icon={Strikethrough} title="Strikethrough" onClick={() => toggle(StrikethroughPlugin.key)} />
        <TBtn icon={Code} title="Inline code" onClick={() => toggle(CodePlugin.key)} />
        <TBtn icon={Highlighter} title="Highlight" onClick={() => toggle(HighlightPlugin.key)} />
        <ColorMenu icon={Baseline} title="Text color" colors={TEXT_COLORS} onPick={(c) => setMark(FontColorPlugin.key, c)} />
        <ColorMenu icon={PaintBucket} title="Background color" colors={HIGHLIGHT_COLORS} onPick={(c) => setMark(FontBackgroundColorPlugin.key, c)} />
        <span className="relative">
          <TBtn icon={Type} title="Font size" onClick={() => setSizeOpen((o) => !o)} />
          {sizeOpen ? (
            <div className="absolute left-0 z-20 mt-1 flex gap-1 rounded-md border bg-popover p-1 shadow-md" onMouseDown={(e) => e.preventDefault()}>
              {FONT_SIZES.map((s) => <button key={s.value} type="button" onMouseDown={(e) => { e.preventDefault(); setMark(FontSizePlugin.key, s.value); setSizeOpen(false); }} className="rounded px-2 py-1 text-xs hover:bg-accent">{s.label}</button>)}
            </div>
          ) : null}
        </span>
        <Sep />
        <TBtn icon={Heading1} title="Heading 1" onClick={() => toggle(H1Plugin.key)} />
        <TBtn icon={Heading2} title="Heading 2" onClick={() => toggle(H2Plugin.key)} />
        <TBtn icon={Heading3} title="Heading 3" onClick={() => toggle(H3Plugin.key)} />
        <TBtn icon={Quote} title="Quote" onClick={() => toggle(BlockquotePlugin.key)} />
        <Sep />
        <ListBtn nodeType="disc" icon={List} title="Bulleted list" />
        <ListBtn nodeType="decimal" icon={ListOrdered} title="Numbered list" />
        <TBtn icon={CheckSquare} title="Checklist (checkbox)" onClick={makeTodo} />
        <TBtn icon={CalendarDays} title="Insert date" onClick={insertDate} />
        <TBtn icon={Boxes} title="Link a record (Plan / Client / Booking)" onClick={() => setRecordOpen(true)} />
        <Sep />
        <TBtn icon={AlignLeft} title="Align left" onClick={() => setAlign("left")} />
        <TBtn icon={AlignCenter} title="Align center" onClick={() => setAlign("center")} />
        <TBtn icon={AlignRight} title="Align right" onClick={() => setAlign("right")} />
        <Sep />
        <TBtn icon={TableIcon} title="Insert table" onClick={doInsertTable} />
        <TBtn icon={Rows3} title="Add row" onClick={doAddRow} />
        <TBtn icon={Columns3} title="Add column" onClick={doAddCol} />
        <TBtn icon={Settings2} title="Table settings (borders, colors)" onClick={() => setTableSettingsOpen(true)} />
        <TBtn icon={Trash2} title="Delete table" onClick={doDeleteTable} />
        <Sep />
        <MediaButton editor={editor} actionToken={actionToken} nodeType={ImagePlugin.key} accept="image/*" icon={ImageIcon} title="Insert image" />
        <MediaButton editor={editor} actionToken={actionToken} nodeType={VideoPlugin.key} accept="video/*" icon={Video} title="Insert video" />
        <MediaButton editor={editor} actionToken={actionToken} nodeType={AudioPlugin.key} accept="audio/*" icon={Music} title="Insert audio" />
        <MediaButton editor={editor} actionToken={actionToken} nodeType={FilePlugin.key} accept="application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" icon={Paperclip} title="Insert document" />
        <TBtn icon={Mic} title="Record audio" onClick={() => setRecorderOpen(true)} />
        <Sep />
        <SimpleTooltip label="Mention someone">
          <button type="button" onMouseDown={(ev) => { ev.preventDefault(); if (!mentionCommands.length) return; const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(r.bottom + 4, r.left, mentionCommands); }} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><AtSign className="h-4 w-4" /></button>
        </SimpleTooltip>
        <span className="relative">
          <TBtn icon={Smile} title="Emoji" onClick={() => setEmojiOpen((o) => !o)} />
          {emojiOpen ? (
            <div className="absolute left-0 z-20 mt-1 grid w-56 grid-cols-8 gap-0.5 rounded-md border bg-popover p-2 shadow-md" onMouseDown={(ev) => ev.preventDefault()}>
              {EMOJIS.map((em) => <button key={em} type="button" onMouseDown={(ev) => { ev.preventDefault(); insertText(em); setEmojiOpen(false); }} className="rounded p-1 text-lg hover:bg-accent">{em}</button>)}
            </div>
          ) : null}
        </span>
        <TBtn icon={ListTree} title="Table of contents" onClick={insertToc} />
        <Sep />
        <TBtn icon={Columns2} title="Columns" onClick={insertColumns} />
        <TBtn icon={FileCode2} title="HTML embed" onClick={() => setHtmlOpen(true)} />
        <Sep />
        <TBtn icon={SquareCode} title="Code block" onClick={insertCodeBlock} />
        <TBtn icon={Link2} title="Insert link" onClick={doInsertLink} />
        <TBtn icon={Minus} title="Divider" onClick={insertDivider} />
        <Sep />
        <TBtn icon={Sparkles} title="Ask AI" onClick={() => setAiOpen(true)} />
        <div className="ml-auto flex items-center gap-1">
          {statusSlot}
          <TBtn icon={rightOpen ? PanelRightClose : PanelRightOpen} title={rightOpen ? "Hide panel" : "Show panel"} onClick={() => setRightOpen((o) => !o)} />
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        {left && leftOpen ? <aside className="sticky top-16 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 self-start overflow-y-auto lg:block">{left}</aside> : null}
        {outlineOpen ? <aside className="sticky top-16 hidden max-h-[calc(100vh-6rem)] w-52 shrink-0 self-start overflow-y-auto md:block"><OutlineNav editor={editor} /></aside> : null}
        <div className="min-w-0 flex-1">
          {titleSlot}
          <PlateContent
            className={cn("min-h-[62vh] rounded-md border bg-background px-4 py-3 text-[15px] leading-7 focus:outline-none [&_p]:my-1.5")}
            placeholder="Start writing… type / for blocks, or use Markdown (# heading, > quote, ** bold, ` code)"
            onKeyDown={(ev: any) => {
              const sel = typeof window !== "undefined" ? window.getSelection() : null;
              if (!sel || !sel.isCollapsed) return;
              const rect = () => (sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null);
              // "/" on an empty line → block insert menu.
              if (ev.key === "/") {
                if ((sel.anchorNode?.textContent ?? "") === "") {
                  ev.preventDefault();
                  const r = rect();
                  openMenu((r?.bottom ?? 220) + 4, r?.left ?? 240, commands);
                }
              } else if (ev.key === "@" && mentionCommands.length) {
                // "@" after whitespace / at line start → mention picker (emails keep typing).
                const before = (sel.anchorNode?.textContent ?? "").slice(0, sel.anchorOffset ?? 0);
                if (before === "" || /\s$/.test(before)) {
                  ev.preventDefault();
                  const r = rect();
                  openMenu((r?.bottom ?? 220) + 4, r?.left ?? 240, mentionCommands);
                }
              } else if (ev.key === "#") {
                // "#" after whitespace / at line start → link a Workspace document (Tab keeps the "#").
                const before = (sel.anchorNode?.textContent ?? "").slice(0, sel.anchorOffset ?? 0);
                if (before === "" || /\s$/.test(before)) {
                  ev.preventDefault();
                  setDocLinkPos(caretPos());
                }
              }
            }}
          />
        </div>
        {right && rightOpen ? <aside className="sticky top-16 hidden max-h-[calc(100vh-6rem)] w-72 shrink-0 self-start overflow-y-auto xl:block">{right}</aside> : null}
      </div>
      <CommandMenu open={menu.open} pos={{ top: menu.top, left: menu.left }} commands={menu.cmds} onClose={closeMenu} />
      {docLinkPos ? <DocLinkMenu pos={docLinkPos} onClose={() => setDocLinkPos(null)} onPick={(d) => { insertDocLink(d); setDocLinkPos(null); }} onTab={() => { insertText("#"); setDocLinkPos(null); }} /> : null}
      <HtmlEmbedDialog open={htmlOpen} onOpenChange={setHtmlOpen} onInsert={insertHtml} />
      <RecorderDialog open={recorderOpen} onOpenChange={setRecorderOpen} actionToken={actionToken} onInsert={insertRecordedAudio} onTranscript={insertAiText} />
      <RecordPickerDialog open={recordOpen} onOpenChange={setRecordOpen} onInsert={insertRecordLink} />
      <AiDialog open={aiOpen} onOpenChange={setAiOpen} getText={getDocText} onInsert={insertAiText} />
      <FindReplaceDialog open={findOpen} onOpenChange={setFindOpen} editor={editor} />
      <TableInsertDialog open={tableInsertOpen} onOpenChange={setTableInsertOpen} onInsert={insertTableSized} />
      <TableSettingsDialog open={tableSettingsOpen} onOpenChange={setTableSettingsOpen} setTableProps={setTableProps} setCellBackground={setCellBackground} />
      <LinkPopover pop={linkPop} onApply={applyLink} onClose={() => setLinkPop(null)} />
    </Plate>
  );
}
