"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, Copy, Download, Loader2, MousePointerClick, Monitor,
  Printer, RefreshCw, Send, Smartphone, Sparkles, Tablet, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PreviewPage } from "@/lib/live-editor/pages";
import {
  CHANGE_TYPES, CHANGE_TYPE_LABELS, NOTE_STATUSES, PRIORITIES,
  SELECTION_MODES, SELECTION_MODE_LABELS,
  type ChangeType, type DeviceMode, type ElementDescriptor, type NoteStatus,
  type Priority, type ReviewElement, type ReviewNote, type ReviewSession, type SelectionMode,
} from "@/lib/live-editor/types";
import { installOverlay, type OverlayController, type OutlineItem } from "./overlay";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "820px",
  mobile: "390px",
};

type ReviewState = { session: ReviewSession | null; elements: ReviewElement[]; notes: ReviewNote[] };

export function LiveEditorClient({ pages, reviewer }: { pages: PreviewPage[]; reviewer: string }) {
  const [pageSlug, setPageSlug] = React.useState(pages[0]?.slug ?? "home");
  const page = pages.find((p) => p.slug === pageSlug) ?? pages[0];

  const [device, setDevice] = React.useState<DeviceMode>("desktop");
  const [mode, setMode] = React.useState<SelectionMode>("auto");
  const [selectActive, setSelectActive] = React.useState(true);
  const [iframeLoading, setIframeLoading] = React.useState(true);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const [selected, setSelected] = React.useState<ElementDescriptor | null>(null);
  const [outline, setOutline] = React.useState<OutlineItem[]>([]);
  const [picker, setPicker] = React.useState<{ x: number; y: number; candidates: ElementDescriptor[] } | null>(null);

  const [review, setReview] = React.useState<ReviewState>({ session: null, elements: [], notes: [] });
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Note draft
  const [noteText, setNoteText] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [status, setStatus] = React.useState<NoteStatus>("open");
  const [changeType, setChangeType] = React.useState<ChangeType>("copy_update");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [exportModal, setExportModal] = React.useState<{ markdown: string; aiBrief: string; html: string; aiVisible: boolean } | null>(null);
  const [exporting, setExporting] = React.useState<null | "export" | "bolt">(null);

  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const overlayRef = React.useRef<OverlayController | null>(null);

  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${page.path}` : page.path;

  // --- Load stored review for the current page ---
  const loadReview = React.useCallback(async (slug: string) => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/site-content/live-editor?page_slug=${encodeURIComponent(slug)}`);
      const json = await res.json() as ReviewState & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setReview({ session: json.session, elements: json.elements ?? [], notes: json.notes ?? [] });
    } catch (err) {
      setReview({ session: null, elements: [], notes: [] });
      setLoadError(err instanceof Error ? err.message : "Failed to load notes.");
    }
  }, []);

  React.useEffect(() => { void loadReview(pageSlug); }, [pageSlug, loadReview]);

  // --- Overlay lifecycle ---
  const teardownOverlay = React.useCallback(() => {
    overlayRef.current?.destroy();
    overlayRef.current = null;
  }, []);

  const handleIframeLoad = React.useCallback(() => {
    setIframeLoading(false);
    teardownOverlay();
    const iframe = iframeRef.current;
    if (!iframe) return;
    let doc: Document | null = null;
    try { doc = iframe.contentDocument; } catch { doc = null; }
    const win = iframe.contentWindow;
    if (!doc || !win) return; // cross-origin or unavailable — preview still shows, just no overlay

    overlayRef.current = installOverlay(doc, win, {
      slug: pageSlug,
      mode,
      active: selectActive,
      onSelect: (desc) => { setSelected(desc); setPicker(null); },
      onOverlap: (candidates, clientX, clientY) => {
        const rect = iframe.getBoundingClientRect();
        setPicker({ x: rect.left + clientX, y: rect.top + clientY, candidates });
      },
      onOutline: (items) => setOutline(items),
    });
    overlayRef.current.scanOutline();
  }, [pageSlug, mode, selectActive, teardownOverlay]);

  React.useEffect(() => () => teardownOverlay(), [teardownOverlay]);
  React.useEffect(() => { overlayRef.current?.setMode(mode); }, [mode]);
  React.useEffect(() => { overlayRef.current?.setActive(selectActive); }, [selectActive]);

  function refresh() {
    setSelected(null);
    setOutline([]);
    setIframeLoading(true);
    teardownOverlay();
    setRefreshNonce((n) => n + 1);
  }

  function changePage(slug: string) {
    setPageSlug(slug);
    setSelected(null);
    setOutline([]);
    setPicker(null);
    setIframeLoading(true);
    teardownOverlay();
  }

  function pickCandidate(desc: ElementDescriptor) {
    setSelected(desc);
    setPicker(null);
    overlayRef.current?.selectByRef(desc.element_ref);
  }

  function selectFromOutline(item: OutlineItem) {
    const desc = overlayRef.current?.selectByRef(item.element_ref);
    if (desc) setSelected(desc);
  }

  // --- Notes ---
  const notesForSelected = React.useMemo(() => {
    if (!selected) return [];
    const el = review.elements.find((e) => e.element_ref === selected.element_ref);
    if (!el) return [];
    return review.notes.filter((n) => n.element_id === el.id);
  }, [selected, review]);

  async function saveNote() {
    if (!selected) { setSaveError("Select an element first."); return; }
    if (!noteText.trim()) { setSaveError("Note text is required."); return; }
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch("/api/site-content/live-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_note",
          payload: {
            page_slug: pageSlug, page_title: page.title, page_url: fullUrl,
            element: selected, note: noteText.trim(), priority, status, change_type: changeType,
          },
        }),
      });
      const json = await res.json() as { session: ReviewSession; element: ReviewElement; note: ReviewNote; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setReview((prev) => ({
        session: json.session,
        elements: prev.elements.some((e) => e.id === json.element.id) ? prev.elements : [...prev.elements, json.element],
        notes: [...prev.notes, json.note],
      }));
      setNoteText("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally { setSaving(false); }
  }

  async function updateNoteStatus(note: ReviewNote, next: NoteStatus) {
    try {
      const res = await fetch("/api/site-content/live-editor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_note", id: note.id, patch: { status: next } }),
      });
      const json = await res.json() as { note: ReviewNote; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      setReview((prev) => ({ ...prev, notes: prev.notes.map((n) => (n.id === json.note.id ? json.note : n)) }));
    } catch { /* silent */ }
  }

  async function removeNote(note: ReviewNote) {
    try {
      await fetch("/api/site-content/live-editor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_note", id: note.id }),
      });
      setReview((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== note.id) }));
    } catch { /* silent */ }
  }

  async function runExport(kind: "export" | "bolt") {
    if (!review.session) { setLoadError("Save at least one note before exporting."); return; }
    setExporting(kind);
    try {
      const res = await fetch("/api/site-content/live-editor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind === "bolt" ? "send_to_bolt" : "export", session_id: review.session.id }),
      });
      const json = await res.json() as { markdown: string; aiBrief: string; html: string; aiVisible: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Export failed.");
      setExportModal({ markdown: json.markdown, aiBrief: json.aiBrief, html: json.html, aiVisible: json.aiVisible });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Export failed.");
    } finally { setExporting(null); }
  }

  const hasNotes = review.notes.length > 0;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <Link href="/dashboard/site-content" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Site Content
        </Link>
        <div className="mx-1 h-5 w-px bg-border" />

        <select
          value={pageSlug}
          onChange={(e) => changePage(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-accent"
        >
          {pages.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
        </select>
        <code className="hidden max-w-[220px] truncate rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground md:inline">{fullUrl}</code>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Device toggle */}
        <div className="inline-flex rounded-md border border-border p-0.5">
          {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
            <button
              key={d}
              type="button"
              title={d}
              onClick={() => setDevice(d)}
              className={cn("inline-flex h-7 w-7 items-center justify-center rounded", device === d ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Selection mode */}
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SelectionMode)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-accent"
          title="Selection mode"
        >
          {SELECTION_MODES.map((m) => <option key={m} value={m}>{SELECTION_MODE_LABELS[m]}</option>)}
        </select>

        <button
          type="button"
          onClick={() => setSelectActive((v) => !v)}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium", selectActive ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground")}
          title="Toggle click-to-select (turn off to scroll/interact freely)"
        >
          <MousePointerClick className="h-3.5 w-3.5" /> {selectActive ? "Selecting" : "Select off"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          <Button size="sm" variant="outline" disabled={!hasNotes || exporting !== null} onClick={() => runExport("export")}>
            {exporting === "export" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Export
          </Button>
          <Button size="sm" variant="accent" disabled={!hasNotes || exporting !== null} onClick={() => runExport("bolt")} title={hasNotes ? "" : "Save a note first"}>
            {exporting === "bolt" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Send to Bolt AI
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[1fr_340px]">
        {/* Preview + outline */}
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="relative flex-1 overflow-auto bg-muted/30 p-4">
            {iframeLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
              </div>
            )}
            <div className="mx-auto h-full transition-all" style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%" }}>
              <iframe
                key={`${pageSlug}-${refreshNonce}`}
                ref={iframeRef}
                src={`${page.path}${page.path.includes("?") ? "&" : "?"}__lpe=${refreshNonce}`}
                title={`Preview — ${page.title}`}
                onLoad={handleIframeLoad}
                className="h-full min-h-[600px] w-full rounded-lg border border-border bg-white shadow-sm"
              />
            </div>
          </div>

          {/* Page outline (detected headings / sections) */}
          <div className="max-h-40 shrink-0 overflow-y-auto border-t border-border bg-card px-4 py-2">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Page outline · {outline.length} detected</div>
            {outline.length === 0 ? (
              <div className="text-xs text-muted-foreground">Detecting headings & sections… hover the preview to inspect elements.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {outline.map((o) => (
                  <button
                    key={o.element_ref}
                    type="button"
                    onClick={() => selectFromOutline(o)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition hover:border-accent hover:text-accent",
                      selected?.element_ref === o.element_ref ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground",
                      o.type === "section" && "font-medium",
                    )}
                    style={{ marginLeft: o.type.match(/^h[3-6]$/) ? 12 : 0 }}
                  >
                    <span className="uppercase opacity-60">{o.type}</span> {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inspector / notes */}
        <aside className="flex min-h-0 flex-col overflow-y-auto bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Live Page Editor</div>
            <div className="mt-0.5 text-sm font-semibold">Element Inspector</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Review-only workflow. Click page elements to attach notes. Nothing here publishes or edits the live site.
            </p>
          </div>

          {/* Selected element */}
          <div className="border-b border-border px-4 py-3">
            {selected ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">{selected.element_type}</span>
                  {selected.heading_level && <span className="text-[10px] text-muted-foreground">H{selected.heading_level}</span>}
                </div>
                <div className="text-sm font-medium">{selected.element_label}</div>
                {selected.parent_section_label && <div className="text-[11px] text-muted-foreground">Section: {selected.parent_section_label}</div>}
                {selected.dom_selector && <code className="block truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{selected.dom_selector}</code>}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No element selected. Hover the preview and click a heading or section.</div>
            )}
          </div>

          {/* Note form */}
          <div className="space-y-3 border-b border-border px-4 py-3">
            <div className="text-xs font-semibold">Add note</div>
            {saveError && <div className="rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{saveError}</div>}
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Describe the change you want for this element…"
              disabled={!selected}
              className="min-h-[72px] w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Priority">
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={selCls} disabled={!selected}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{cap(p)}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value as NoteStatus)} className={selCls} disabled={!selected}>
                  {NOTE_STATUSES.map((s) => <option key={s} value={s}>{cap(s.replace("_", " "))}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Change type">
              <select value={changeType} onChange={(e) => setChangeType(e.target.value as ChangeType)} className={selCls} disabled={!selected}>
                {CHANGE_TYPES.map((c) => <option key={c} value={c}>{CHANGE_TYPE_LABELS[c]}</option>)}
              </select>
            </Field>
            <Button size="sm" variant="accent" className="w-full" disabled={!selected || saving} onClick={() => void saveNote()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save note
            </Button>
            {notesForSelected.length > 0 && (
              <div className="text-[11px] text-muted-foreground">{notesForSelected.length} note{notesForSelected.length !== 1 ? "s" : ""} on this element.</div>
            )}
          </div>

          {/* All notes for page */}
          <div className="flex-1 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold">Notes on this page</div>
              <span className="text-[11px] text-muted-foreground">{review.notes.length}</span>
            </div>
            {loadError && <div className="mb-2 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{loadError}</div>}
            {review.notes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">No notes yet.</div>
            ) : (
              <div className="space-y-2">
                {review.notes.map((n) => {
                  const el = review.elements.find((e) => e.id === n.element_id);
                  return (
                    <div key={n.id} className="rounded-lg border border-border bg-background p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_TONE[n.priority])}>{n.priority}</span>
                        {el?.element_type && <span className="text-[10px] text-muted-foreground">{el.element_type}</span>}
                        {n.ai_generated && <span className="rounded bg-accent/15 px-1 text-[9px] font-semibold uppercase text-accent">AI draft</span>}
                        <button type="button" onClick={() => void removeNote(n)} className="ml-auto text-muted-foreground hover:text-destructive" title="Delete note"><Trash2 className="h-3 w-3" /></button>
                      </div>
                      {el?.heading_text && <div className="mt-1 truncate text-[11px] font-medium">{el.heading_text}</div>}
                      <div className="mt-1 text-xs">{n.note}</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {n.change_type && <span className="text-[10px] text-muted-foreground">{CHANGE_TYPE_LABELS[n.change_type] ?? n.change_type}</span>}
                        <select value={n.status} onChange={(e) => void updateNoteStatus(n, e.target.value as NoteStatus)} className="ml-auto h-6 rounded border border-border bg-background px-1 text-[10px] outline-none">
                          {NOTE_STATUSES.map((s) => <option key={s} value={s}>{cap(s.replace("_", " "))}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Overlap picker */}
      {picker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <div className="fixed z-50 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-xl" style={{ left: Math.min(picker.x, (typeof window !== "undefined" ? window.innerWidth : 9999) - 270), top: picker.y }}>
            <div className="border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Choose element level</div>
            {picker.candidates.map((c) => (
              <button key={c.element_ref} type="button" onClick={() => pickCandidate(c)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted">
                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">{c.element_type}</span>
                <span className="truncate">{c.element_label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Export modal */}
      {exportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setExportModal(null)} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="font-semibold">{exportModal.aiVisible ? "AI Brief for Bolt" : "Exported Review"}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {exportModal.aiVisible
                    ? "Saved & flagged for Bolt. Copy this brief into Bolt — AI changes come back as drafts for your review."
                    : "Structured, AI-readable review. Copy or download."}
                </p>
              </div>
              <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => setExportModal(null)}><X className="h-4 w-4" /></button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap bg-muted/40 p-4 text-[11px] leading-relaxed">{exportModal.aiVisible ? exportModal.aiBrief : exportModal.markdown}</pre>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
              <span className="mr-auto text-[11px] text-muted-foreground">Bolt reads the text brief. The PDF is a visual reference for people.</span>
              <CopyButton text={exportModal.aiVisible ? exportModal.aiBrief : exportModal.markdown} />
              <Button size="sm" variant="outline" onClick={() => downloadText(exportModal.aiVisible ? exportModal.aiBrief : exportModal.markdown, exportModal.aiVisible ? `${pageSlug}-ai-brief.txt` : `${pageSlug}-review.md`)}>
                <Download className="h-3.5 w-3.5" /> {exportModal.aiVisible ? ".txt" : ".md"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => printHtml(exportModal.html)}>
                <Printer className="h-3.5 w-3.5" /> Save as PDF
              </Button>
              {exportModal.aiVisible && (
                <Link href="/dashboard/agent" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-foreground hover:opacity-90">
                  <Send className="h-3.5 w-3.5" /> Open Bolt
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selCls = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-accent disabled:opacity-50";
const PRIORITY_TONE: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>{children}</div>;
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button size="sm" variant="accent" onClick={() => { void navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }}>
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : "Copy"}
    </Button>
  );
}
function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
// Open the printable HTML report in a new window and trigger the browser's
// print dialog (Save as PDF). Zero-dependency PDF path.
function printHtml(html: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* user can print manually */ } }, 400);
}
