"use client";

import * as React from "react";
import {
  Bold, Heading2, Heading3, Image, Italic,
  Link2, List, ListOrdered, MoreHorizontal,
  Newspaper, Plus, Quote, Search, Underline, X,
  Calendar, Send, Mail, Users, ChevronDown, Code2,
  AlignLeft, CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BlogDraft, BlogPost, BlogStatus } from "@/lib/blog/types";

const STATUSES: BlogStatus[] = ["draft", "published", "scheduled", "archived"];
const CATEGORIES = ["ADU", "Commercial", "Residential", "Interior Design", "New Construction", "Project Management", "Renovation", "Industry News", "Company News", "Resources"];

const STATUS_TONES: Record<BlogStatus, "warning" | "success" | "info" | "default"> = {
  draft: "warning",
  published: "success",
  scheduled: "info",
  archived: "default",
};

type EditorMode = "standard" | "html";
type EmailRecipients = "contacts" | "staff" | "subscribers" | "all";
type View = "list" | "editor";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function autoSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const EMPTY_DRAFT: BlogDraft = {
  title: "",
  slug: "",
  category: "",
  tags: [],
  excerpt: "",
  content: "",
  featured_image: "",
  author: "Jeremy Waters",
  status: "draft",
  published_at: null,
};

export function BlogClient({ initialPosts }: { initialPosts: BlogPost[] }) {
  const [posts, setPosts] = React.useState<BlogPost[]>(initialPosts);
  const [view, setView] = React.useState<View>("list");
  const [editingPost, setEditingPost] = React.useState<BlogPost | null>(null);
  const [draft, setDraft] = React.useState<BlogDraft>(EMPTY_DRAFT);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [tagInput, setTagInput] = React.useState("");

  // Editor mode (Standard vs HTML)
  const [editorMode, setEditorMode] = React.useState<EditorMode>("standard");
  const editorRef = React.useRef<HTMLDivElement>(null);

  // Schedule picker
  const [showSchedule, setShowSchedule] = React.useState(false);
  const [scheduleDate, setScheduleDate] = React.useState("");
  const scheduleRef = React.useRef<HTMLDivElement>(null);

  // Email blast
  const [emailBlastEnabled, setEmailBlastEnabled] = React.useState(false);
  const [emailRecipients, setEmailRecipients] = React.useState<EmailRecipients>("contacts");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [emailSending, setEmailSending] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);

  // Close schedule picker on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (scheduleRef.current && !scheduleRef.current.contains(e.target as Node)) {
        setShowSchedule(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.category ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, search, statusFilter]);

  function openNew() {
    setDraft({ ...EMPTY_DRAFT });
    setEditingPost(null);
    setTagInput("");
    setError(null);
    setEditorMode("standard");
    setEmailBlastEnabled(false);
    setEmailSent(false);
    setEmailError(null);
    setScheduleDate("");
    setView("editor");
  }

  function openEdit(p: BlogPost) {
    setDraft({ title: p.title, slug: p.slug ?? "", category: p.category ?? "", tags: p.tags ?? [], excerpt: p.excerpt ?? "", content: p.content ?? "", featured_image: p.featured_image ?? "", author: p.author ?? "Jeremy Waters", status: p.status, published_at: p.published_at });
    setEditingPost(p);
    setTagInput("");
    setError(null);
    setEditorMode("standard");
    setEmailBlastEnabled(false);
    setEmailSent(false);
    setEmailError(null);
    setScheduleDate(p.published_at ? p.published_at.slice(0, 16) : "");
    setView("editor");
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = p.content ?? "";
    }, 50);
  }

  function switchEditorMode(mode: EditorMode) {
    if (mode === editorMode) return;
    if (mode === "html") {
      // Standard → HTML: capture current rich text HTML
      const html = editorRef.current?.innerHTML ?? draft.content ?? "";
      setDraft((d) => ({ ...d, content: html }));
    } else {
      // HTML → Standard: push textarea content into the editable div
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = draft.content ?? "";
      }, 10);
    }
    setEditorMode(mode);
  }

  function execCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }

  function syncContent() {
    if (editorRef.current) setDraft((d) => ({ ...d, content: editorRef.current!.innerHTML }));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || (draft.tags ?? []).includes(t)) { setTagInput(""); return; }
    setDraft((d) => ({ ...d, tags: [...(d.tags ?? []), t] }));
    setTagInput("");
  }

  function getContent() {
    if (editorMode === "html") return draft.content ?? "";
    return editorRef.current?.innerHTML ?? draft.content ?? "";
  }

  async function save(status?: BlogStatus) {
    const content = getContent();
    const payload: BlogDraft = { ...draft, content };
    if (status) payload.status = status;
    if (!payload.title) { setError("Title is required."); return; }
    if (!payload.slug) payload.slug = autoSlug(payload.title);
    if (payload.status === "published" && !payload.published_at) payload.published_at = new Date().toISOString();

    setSaving(true); setError(null);
    try {
      let savedPost: BlogPost;
      if (editingPost) {
        const res = await fetch(`/api/blog/${editingPost.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const json = await res.json() as BlogPost & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setPosts((prev) => prev.map((p) => (p.id === json.id ? json : p)));
        savedPost = json;
      } else {
        const res = await fetch("/api/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const json = await res.json() as BlogPost & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setPosts((prev) => [json, ...prev]);
        savedPost = json;
      }
      // Trigger email blast on publish if enabled
      if (emailBlastEnabled && payload.status === "published") {
        void sendEmailBlast(savedPost.id, "now");
      }
      setView("list");
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function saveScheduled() {
    if (!scheduleDate) { setError("Pick a date and time first."); return; }
    setDraft((d) => ({ ...d, status: "scheduled", published_at: new Date(scheduleDate).toISOString() }));
    setShowSchedule(false);
    // Use a small delay to let state flush
    await new Promise((r) => setTimeout(r, 20));
    const content = getContent();
    const payload: BlogDraft = { ...draft, content, status: "scheduled", published_at: new Date(scheduleDate).toISOString() };
    if (!payload.title) { setError("Title is required."); return; }
    if (!payload.slug) payload.slug = autoSlug(payload.title);

    setSaving(true); setError(null);
    try {
      if (editingPost) {
        const res = await fetch(`/api/blog/${editingPost.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const json = await res.json() as BlogPost & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setPosts((prev) => prev.map((p) => (p.id === json.id ? json : p)));
      } else {
        const res = await fetch("/api/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const json = await res.json() as BlogPost & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setPosts((prev) => [json, ...prev]);
      }
      setView("list");
    } catch (err) { setError(err instanceof Error ? err.message : "Schedule failed."); }
    finally { setSaving(false); }
  }

  async function sendEmailBlast(postId: string, when: "now" | "scheduled") {
    setEmailSending(true); setEmailError(null); setEmailSent(false);
    try {
      const res = await fetch(`/api/blog/${postId}/email-blast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: emailRecipients,
          subject: emailSubject || draft.title,
          when,
          scheduled_at: when === "scheduled" ? scheduleDate : null,
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setEmailSent(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Email blast failed.");
    } finally {
      setEmailSending(false);
    }
  }

  async function confirmDelete(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/blog/${id}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    } finally { setSaving(false); }
  }

  // ── List view ───────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col">
        <div className="border-b border-border bg-card px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Content</div>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Blog</h1>
              <p className="mt-1 text-sm text-muted-foreground">{posts.length} posts</p>
            </div>
            <Button size="sm" variant="accent" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Post</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Search posts…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground outline-none focus:border-accent">
              <option value="all">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Title</th>
                <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">Category</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">Date</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No posts found.</td></tr>}
              {filtered.map((p) => (
                <tr key={p.id} className="cursor-pointer transition hover:bg-muted/30" onClick={() => openEdit(p)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {p.featured_image ? (
                        <img src={p.featured_image} alt="" className="h-9 w-14 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded bg-muted"><Newspaper className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div>
                        <span className="font-medium">{p.title}</span>
                        {p.status === "scheduled" && p.published_at && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-info">
                            <Calendar className="h-3 w-3" />
                            Scheduled · {formatDate(p.published_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{p.category ?? "—"}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONES[p.status]}>{p.status}</Badge></td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{p.published_at ? formatDate(p.published_at) : formatDate(p.created_at)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(p.id); }}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
            <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
              <h2 className="font-semibold">Delete Post</h2>
              <p className="mt-2 text-sm text-muted-foreground">This will permanently delete the post. This cannot be undone.</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button size="sm" variant="outline" className="border-destructive text-destructive" onClick={() => void confirmDelete(deleteConfirm)}>{saving ? "Deleting…" : "Delete"}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Editor view ─────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2 gap-2">
        <button type="button" onClick={() => setView("list")} className="text-sm text-muted-foreground hover:text-foreground shrink-0">
          ← Back to posts
        </button>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {error && <span className="text-xs text-destructive">{error}</span>}

          <Button size="sm" variant="outline" onClick={() => void save("draft")} disabled={saving}>
            Save Draft
          </Button>

          {/* Schedule button + picker */}
          <div className="relative" ref={scheduleRef}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSchedule((v) => !v)}
              disabled={saving}
              className={cn(draft.status === "scheduled" && "border-info text-info")}
            >
              <Calendar className="h-3.5 w-3.5" />
              {draft.status === "scheduled" && scheduleDate
                ? `Scheduled · ${new Date(scheduleDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : "Schedule"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showSchedule && "rotate-180")} />
            </Button>
            {showSchedule && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border bg-card p-4 shadow-xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Schedule Publish</p>
                <input
                  type="datetime-local"
                  className="h-8 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-accent"
                  value={scheduleDate}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                {emailBlastEnabled && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Mail className="h-3 w-3 text-accent" />
                    Email blast will send at publish time
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowSchedule(false)}>Cancel</Button>
                  <Button size="sm" variant="accent" onClick={() => void saveScheduled()} disabled={!scheduleDate || saving}>
                    <Calendar className="h-3.5 w-3.5" /> Confirm Schedule
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button size="sm" variant="accent" onClick={() => void save("published")} disabled={saving}>
            {saving ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main editor area */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {/* Title */}
          <input
            className="mb-5 w-full bg-transparent font-display text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
            placeholder="Post title…"
            value={draft.title}
            onChange={(e) => {
              const title = e.target.value;
              setDraft((d) => ({ ...d, title, slug: d.slug === autoSlug(d.title) || !d.slug ? autoSlug(title) : d.slug }));
              if (!emailSubject) setEmailSubject(title);
            }}
          />

          {/* Editor mode tabs */}
          <div className="mb-2 flex items-center gap-0.5 border-b border-border">
            <EditorTab active={editorMode === "standard"} onClick={() => switchEditorMode("standard")} icon={AlignLeft} label="Standard" />
            <EditorTab active={editorMode === "html"} onClick={() => switchEditorMode("html")} icon={Code2} label="HTML" />
          </div>

          {/* Standard mode: rich text toolbar + editable div */}
          <div className={cn(editorMode !== "standard" && "hidden")}>
            <div className="mb-2 flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-muted/30 p-1.5">
              {[
                { icon: Bold, cmd: "bold" },
                { icon: Italic, cmd: "italic" },
                { icon: Underline, cmd: "underline" },
              ].map(({ icon: Icon, cmd }) => (
                <button key={cmd} type="button" onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
              <div className="mx-1 h-4 w-px bg-border" />
              {[
                { icon: Heading2, cmd: "formatBlock", val: "h2" },
                { icon: Heading3, cmd: "formatBlock", val: "h3" },
              ].map(({ icon: Icon, cmd, val }) => (
                <button key={val} type="button" onMouseDown={(e) => { e.preventDefault(); execCmd(cmd, val); }} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
              <div className="mx-1 h-4 w-px bg-border" />
              <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"><List className="h-3.5 w-3.5" /></button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"><ListOrdered className="h-3.5 w-3.5" /></button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("formatBlock", "blockquote"); }} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"><Quote className="h-3.5 w-3.5" /></button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); const url = prompt("URL:"); if (url) execCmd("createLink", url); }} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"><Link2 className="h-3.5 w-3.5" /></button>
              <div className="mx-1 h-4 w-px bg-border" />
              <button type="button" onMouseDown={(e) => { e.preventDefault(); const url = prompt("Image URL:"); if (url) execCmd("insertImage", url); }} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"><Image className="h-3.5 w-3.5" /></button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncContent}
              className="prose prose-sm dark:prose-invert min-h-[400px] flex-1 rounded-md border border-border bg-background p-4 text-sm outline-none focus:border-accent"
              data-placeholder="Write your post content here…"
            />
          </div>

          {/* HTML mode: raw textarea */}
          {editorMode === "html" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Raw HTML — changes sync back to Standard mode on tab switch</span>
                <span>{(draft.content ?? "").length} chars</span>
              </div>
              <textarea
                className="min-h-[420px] w-full resize-y rounded-md border border-border bg-background p-4 font-mono text-xs leading-relaxed outline-none focus:border-accent"
                value={draft.content ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                spellCheck={false}
              />
            </div>
          )}

          {/* Excerpt */}
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">Excerpt</label>
            <textarea
              className="mt-1 h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Brief summary for previews and SEO…"
              value={draft.excerpt ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden w-[272px] shrink-0 overflow-y-auto border-l border-border bg-card p-4 lg:block">
          <div className="space-y-5">

            {/* Publish */}
            <SideSection title="Publish">
              <div className="space-y-2">
                <Field label="Status">
                  <select className={inputCls} value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as BlogStatus }))}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </Field>
                {(draft.status === "scheduled") && (
                  <Field label="Publish Date & Time">
                    <input
                      type="datetime-local"
                      className={inputCls}
                      value={scheduleDate || (draft.published_at?.slice(0, 16) ?? "")}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => {
                        setScheduleDate(e.target.value);
                        setDraft((d) => ({ ...d, published_at: e.target.value ? new Date(e.target.value).toISOString() : null }));
                      }}
                    />
                  </Field>
                )}
                <Field label="Slug">
                  <input className={inputCls} value={draft.slug ?? ""} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} placeholder="auto-generated" />
                </Field>
              </div>
            </SideSection>

            {/* Category */}
            <SideSection title="Category">
              <select className={inputCls} value={draft.category ?? ""} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                <option value="">— Select —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </SideSection>

            {/* Tags */}
            <SideSection title="Tags">
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
                {(draft.tags ?? []).map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                    {t}<button type="button" onClick={() => setDraft((d) => ({ ...d, tags: (d.tags ?? []).filter((x) => x !== t) }))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <input
                  className="min-w-[60px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  placeholder="Add tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                />
              </div>
            </SideSection>

            {/* Author */}
            <SideSection title="Author">
              <input className={inputCls} value={draft.author ?? ""} onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} />
            </SideSection>

            {/* Featured Image */}
            <SideSection title="Featured Image">
              <input className={inputCls} placeholder="Image URL…" value={draft.featured_image ?? ""} onChange={(e) => setDraft((d) => ({ ...d, featured_image: e.target.value }))} />
              {draft.featured_image ? (
                <img src={draft.featured_image} alt="" className="mt-2 w-full rounded object-cover" style={{ maxHeight: 120 }} />
              ) : (
                <div className="mt-2 flex h-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  <Image className="mr-1.5 h-4 w-4" /> Add URL above
                </div>
              )}
            </SideSection>

            {/* ── Email Blast ─────────────────────────────── */}
            <SideSection title="Email Blast">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => { setEmailBlastEnabled((v) => !v); setEmailSent(false); setEmailError(null); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition",
                  emailBlastEnabled
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {emailBlastEnabled ? "Email blast enabled" : "Send as email"}
                </span>
                <div className={cn("h-4 w-7 rounded-full transition-colors", emailBlastEnabled ? "bg-accent" : "bg-border")}>
                  <div className={cn("m-0.5 h-3 w-3 rounded-full bg-white transition-transform", emailBlastEnabled && "translate-x-3")} />
                </div>
              </button>

              {emailBlastEnabled && (
                <div className="mt-3 space-y-3">
                  {/* Recipients */}
                  <Field label="Recipients">
                    <div className="space-y-1.5">
                      {([
                        { value: "contacts",    label: "All Contacts",      icon: Users },
                        { value: "staff",       label: "All Staff Users",   icon: Users },
                        { value: "subscribers", label: "Subscribers",       icon: Mail },
                        { value: "all",         label: "Everyone",          icon: Users },
                      ] as { value: EmailRecipients; label: string; icon: React.ElementType }[]).map(({ value, label, icon: Icon }) => (
                        <label key={value} className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-xs transition",
                          emailRecipients === value ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/30"
                        )}>
                          <input type="radio" name="email_recipients" value={value} checked={emailRecipients === value} onChange={() => setEmailRecipients(value)} className="sr-only" />
                          <Icon className="h-3 w-3 shrink-0" />
                          {label}
                          {emailRecipients === value && <CheckCircle2 className="ml-auto h-3 w-3" />}
                        </label>
                      ))}
                    </div>
                  </Field>

                  {/* Subject override */}
                  <Field label="Email Subject">
                    <input
                      className={inputCls}
                      placeholder={draft.title || "Email subject…"}
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </Field>

                  {/* When to send */}
                  <div className="rounded-md border border-border bg-background p-2.5 text-[11px] text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground text-xs">When will it send?</p>
                    {draft.status === "scheduled"
                      ? <p>Sends when the post publishes{scheduleDate ? ` on ${new Date(scheduleDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}.</p>
                      : <p>Sends immediately when you click <strong>Publish</strong>.</p>
                    }
                  </div>

                  {/* Error / sent feedback */}
                  {emailError && (
                    <p className="rounded-md bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">{emailError}</p>
                  )}
                  {emailSent && (
                    <p className="flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-2 text-[11px] text-success">
                      <CheckCircle2 className="h-3 w-3" /> Email blast queued successfully.
                    </p>
                  )}

                  {/* Manual send (for already-published posts) */}
                  {editingPost?.status === "published" && (
                    <Button
                      size="sm"
                      variant="accent"
                      className="w-full"
                      disabled={emailSending || emailSent}
                      onClick={() => void sendEmailBlast(editingPost.id, "now")}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {emailSending ? "Sending…" : emailSent ? "Sent!" : "Send Now"}
                    </Button>
                  )}
                </div>
              )}
            </SideSection>

          </div>
        </aside>
      </div>
    </div>
  );
}

function EditorTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium transition border-b-2 -mb-px",
        active ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

const inputCls = "h-8 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-[11px] font-medium text-muted-foreground">{label}</label>{children}</div>;
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-5 last:border-0 last:pb-0">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
