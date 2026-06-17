"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Code2, LayoutTemplate, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailTemplate } from "./types";
import { TRIGGER_EVENTS } from "./types";
import { TemplateEditor } from "./template-editor";

type ListTemplate = Pick<EmailTemplate, "id" | "name" | "subject" | "builder_type" | "trigger_event" | "status" | "created_at" | "updated_at">;

function triggerLabel(value: string | null) {
  if (!value) return null;
  return TRIGGER_EVENTS.find(t => t.value === value)?.label ?? value;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function TemplateManager() {
  const [templates, setTemplates] = React.useState<ListTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<EmailTemplate | null | "new">(null);
  const [fullTemplate, setFullTemplate] = React.useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates");
      const data = await res.json() as { templates?: ListTemplate[] };
      setTemplates(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { void load(); }, []);

  async function openEdit(t: ListTemplate) {
    const res = await fetch(`/api/admin/email-templates/${t.id}`);
    const data = await res.json() as { template?: EmailTemplate };
    if (data.template) {
      setFullTemplate(data.template);
      setEditing(data.template);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/email-templates/${id}`, { method: "DELETE" });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function handleSaved(saved: EmailTemplate) {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === saved.id);
      const entry: ListTemplate = {
        id: saved.id, name: saved.name, subject: saved.subject,
        builder_type: saved.builder_type, trigger_event: saved.trigger_event,
        status: saved.status, created_at: saved.created_at, updated_at: saved.updated_at,
      };
      if (idx === -1) return [entry, ...prev];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
    setEditing(saved);
  }

  // Show editor when editing
  if (editing !== null) {
    return (
      <div className="flex h-full flex-col">
        <TemplateEditor
          template={editing === "new" ? null : editing as EmailTemplate}
          onSave={handleSaved}
          onBack={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Communications</div>
          <h2 className="mt-0.5 text-lg font-semibold">Email Templates</h2>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
        >
          <Plus className="h-3.5 w-3.5" /> New Template
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-5">
            {[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
              <LayoutTemplate className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No templates yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Create your first email template to use with automations or manual sends.
            </p>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="mt-4 flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Create Template
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Trigger</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map(t => (
                <tr key={t.id} className="group transition hover:bg-muted/30">
                  <td className="px-5 py-3.5 font-medium">{t.name}</td>
                  <td className="max-w-[200px] truncate px-5 py-3.5 text-muted-foreground">{t.subject || "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {t.builder_type === "visual"
                        ? <><LayoutTemplate className="h-3.5 w-3.5 text-accent" /> Visual</>
                        : <><Code2 className="h-3.5 w-3.5 text-accent" /> HTML</>}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {triggerLabel(t.trigger_event)
                      ? <span className="flex items-center gap-1 text-xs"><Zap className="h-3 w-3 text-accent" />{triggerLabel(t.trigger_event)}</span>
                      : <span className="text-xs text-muted-foreground">Manual</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      t.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    )}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{timeAgo(t.updated_at)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button type="button" onClick={() => void openEdit(t)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => void deleteTemplate(t.id)} disabled={deleting === t.id}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
