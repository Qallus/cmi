"use client";

import * as React from "react";
import { ArrowLeft, Check, Loader2, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailBlock, EmailSettings, EmailTemplate } from "./types";
import { TRIGGER_EVENTS } from "./types";
import { Select } from "@/components/ui/input";
import { VisualEditor } from "./visual-editor";
import { HtmlEditor } from "./html-editor";
import { blocksToHtml } from "./renderer";

type BuilderTab = "visual" | "html";

interface Props {
  template: EmailTemplate | null;
  onSave: (saved: EmailTemplate) => void;
  onBack: () => void;
  /** Triggers already in use, so the list grows as staff add their own. */
  knownTriggers?: string[];
}

const EMPTY_TEMPLATE: Omit<EmailTemplate, "id" | "created_at" | "updated_at"> = {
  name: "",
  subject: "",
  preview_text: "",
  builder_type: "visual",
  blocks: [],
  settings: {},
  html: "",
  trigger_event: null,
  status: "draft",
};

export function TemplateEditor({ template, onSave, onBack, knownTriggers = [] }: Props) {
  const isNew = !template?.id;
  const [builderTab, setBuilderTab] = React.useState<BuilderTab>(template?.builder_type ?? "visual");
  const [name, setName] = React.useState(template?.name ?? "");
  const [subject, setSubject] = React.useState(template?.subject ?? "");
  const [previewText, setPreviewText] = React.useState(template?.preview_text ?? "");
  const [triggerEvent, setTriggerEvent] = React.useState(template?.trigger_event ?? "");
  const [status, setStatus] = React.useState<"draft" | "active">(template?.status ?? "draft");
  const [blocks, setBlocks] = React.useState<EmailBlock[]>(template?.blocks ?? []);
  const [settings, setSettings] = React.useState<EmailSettings>(template?.settings ?? {});
  const [html, setHtml] = React.useState(template?.html ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  // When switching to HTML tab, sync blocks → html if html is empty
  function switchTab(tab: BuilderTab) {
    if (tab === "html" && !html && blocks.length > 0) {
      setHtml(blocksToHtml(blocks, settings));
    }
    setBuilderTab(tab);
  }

  async function save() {
    if (!name.trim()) { setError("Template name is required."); return; }
    setSaving(true); setError("");
    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      preview_text: previewText.trim(),
      builder_type: builderTab,
      blocks: builderTab === "visual" ? blocks : [],
      settings,
      html: builderTab === "html" ? html : blocksToHtml(blocks, settings),
      trigger_event: triggerEvent || null,
      status,
    };

    try {
      const url = isNew ? "/api/admin/email-templates" : `/api/admin/email-templates/${template!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { template?: EmailTemplate; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Save failed.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (data.template) onSave(data.template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button type="button" onClick={onBack} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>

        <input
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium outline-none focus:border-accent"
          placeholder="Template name…"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Builder tab switcher */}
        <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
          {(["visual", "html"] as BuilderTab[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => switchTab(tab)}
              className={cn(
                "rounded px-3 py-1.5 font-medium capitalize transition",
                builderTab === tab ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "visual" ? "Visual" : "HTML"}
            </button>
          ))}
        </div>

        <select
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          value={status}
          onChange={e => setStatus(e.target.value as "draft" | "active")}
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
        </select>

        {error && <span className="text-xs text-destructive">{error}</span>}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>

      {/* Meta fields */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4 py-2.5">
        <div className="flex flex-1 items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">Subject</span>
          <input
            className="flex-1 rounded border border-border bg-background px-2.5 py-1 text-sm outline-none focus:border-accent"
            placeholder="Email subject line…"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>
        <div className="flex flex-1 items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">Preview Text</span>
          <input
            className="flex-1 rounded border border-border bg-background px-2.5 py-1 text-sm outline-none focus:border-accent"
            placeholder="Short preview shown in inbox…"
            value={previewText}
            onChange={e => setPreviewText(e.target.value)}
          />
        </div>
        <TriggerField value={triggerEvent} onChange={setTriggerEvent} known={knownTriggers} />
      </div>

      {/* Builder area */}
      <div className="flex-1 overflow-hidden">
        {builderTab === "visual"
          ? <VisualEditor blocks={blocks} onChange={setBlocks} settings={settings} onSettingsChange={setSettings} />
          : <HtmlEditor html={html} onChange={setHtml} />
        }
      </div>
    </div>
  );
}

const OTHER = "__other__";

/** A trigger slug: lowercase, underscores, no leading or trailing junk. */
function slugifyTrigger(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

const prettyTrigger = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Which event fires this email.
 *
 * The built-in list is the events the app knows how to raise; anything staff
 * have already typed is added to it, so a trigger invented once is offered
 * from then on instead of being retyped. "Other" takes a new one.
 */
function TriggerField({
  value, onChange, known,
}: {
  value: string;
  onChange: (v: string) => void;
  known: string[];
}) {
  const builtIn = new Set(TRIGGER_EVENTS.map((t) => t.value));
  const custom = [...new Set(known.filter((k) => k && !builtIn.has(k)))].sort();
  // A value loaded from a template that is neither built-in nor in the list yet.
  const orphan = value && !builtIn.has(value) && !custom.includes(value) ? [value] : [];

  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  function commit() {
    const slug = slugifyTrigger(draft);
    if (slug) onChange(slug);
    setAdding(false);
    setDraft("");
  }

  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">Trigger</span>
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            className="w-44 rounded border border-border bg-background px-2.5 py-1 text-sm outline-none focus:border-accent"
            placeholder="interview_scheduled"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { e.preventDefault(); setAdding(false); setDraft(""); }
            }}
          />
          <button type="button" onClick={commit} className="rounded border border-border px-2 py-1 text-xs font-medium transition hover:bg-muted">Add</button>
          <button type="button" onClick={() => { setAdding(false); setDraft(""); }} aria-label="Cancel"
            className="rounded p-1 text-muted-foreground transition hover:text-foreground">
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Select
          className="h-8 w-auto min-w-[190px] text-sm"
          value={value}
          onChange={(e) => {
            if (e.target.value === OTHER) { setAdding(true); return; }
            onChange(e.target.value);
          }}
        >
          {TRIGGER_EVENTS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
          {[...custom, ...orphan].map((v) => (
            <option key={v} value={v}>{prettyTrigger(v)}</option>
          ))}
          <option value={OTHER}>Other\u2026</option>
        </Select>
      )}
    </div>
  );
}
