"use client";

import * as React from "react";
import { Bold, Heading2, Image as ImageIcon, Italic, Link2, List, ListOrdered, Loader2, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/notes/html";
import { uploadNoteFile } from "./notes-api";

function ToolbarBtn({ onClick, title, children, active }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={cn("grid h-7 w-7 place-items-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground", active && "bg-muted text-foreground")}
    >
      {children}
    </button>
  );
}

// A lightweight contentEditable rich-text editor. Emits sanitized HTML.
// Uncontrolled internally (initial value set once) to avoid caret jumps; parent
// gets updates via onChange.
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const savedRange = React.useRef<Range | null>(null);

  // Seed the editor once. We deliberately don't re-sync from `value` on every
  // render — that would reset the caret while typing.
  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = React.useCallback(() => {
    if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML));
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  function rememberSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  }

  function applyLink() {
    const url = linkUrl.trim();
    setLinkOpen(false);
    setLinkUrl("");
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    ref.current?.focus();
    restoreSelection();
    // If nothing is selected, insert the URL text as the link label.
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) document.execCommand("insertText", false, url);
    if (sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    document.execCommand("createLink", false, href);
    emit();
  }

  async function onImageFile(file: File) {
    setUploading(true);
    try {
      const att = await uploadNoteFile(file);
      const src = `/api/notes/image?path=${encodeURIComponent(att.path)}`;
      ref.current?.focus();
      restoreSelection();
      document.execCommand("insertImage", false, src);
      emit();
    } catch {
      /* surfaced by the empty image; keep the editor usable */
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-md border border-border focus-within:border-accent">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
        <ToolbarBtn title="Bold" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Italic" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Underline" onClick={() => exec("underline")}><Underline className="h-3.5 w-3.5" /></ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarBtn title="Heading" onClick={() => exec("formatBlock", "<h2>")}><Heading2 className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Bullet list" onClick={() => exec("insertUnorderedList")}><List className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarBtn title="Link" onClick={() => { rememberSelection(); setLinkOpen((v) => !v); }}><Link2 className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Insert image" onClick={() => { rememberSelection(); fileRef.current?.click(); }}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
        </ToolbarBtn>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImageFile(f); }} />
      </div>

      {/* Link input row */}
      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1.5">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") { setLinkOpen(false); setLinkUrl(""); } }}
            placeholder="https://example.com"
            className="h-7 flex-1 rounded border border-border bg-background px-2 text-xs outline-none focus:border-accent"
          />
          <button type="button" onClick={applyLink} className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white">Add link</button>
        </div>
      )}

      {/* Editable surface */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        className="cmi-richtext min-h-[180px] w-full overflow-y-auto px-3 py-2 text-sm outline-none"
      />
    </div>
  );
}
