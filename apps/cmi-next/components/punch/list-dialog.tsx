"use client";

// Create or edit a punch list: title, description, starting template, what
// it's attached to, and (Jobs only) whether the client can see it.
import * as React from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { cn } from "@/lib/utils";
import type { PunchList, PunchParent } from "@/lib/punch/types";
import { api, Field, inputCls, Modal, TargetPicker, type PunchMeta } from "./shared";

export function ListDialog({ meta, list, fixedParent, onClose, onSaved }: {
  meta: PunchMeta;
  /** Editing an existing list; omitted when creating. */
  list?: PunchList;
  /** Creating from a record's page: the parent is already known. */
  fixedParent?: PunchParent | null;
  onClose: () => void;
  onSaved: (list: PunchList) => void;
}) {
  const editing = !!list;
  const [title, setTitle] = React.useState(list?.title ?? "");
  const [description, setDescription] = React.useState(list?.description ?? "");
  const [templateId, setTemplateId] = React.useState("");
  const [parent, setParent] = React.useState<PunchParent | null>(list?.parent ?? fixedParent ?? null);
  const [clientVisible, setClientVisible] = React.useState(list?.client_visible ?? false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const template = meta.templates.find((t) => t.id === templateId);
  const isJob = parent?.type === "job";

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = meta.templates.find((x) => x.id === id);
    if (t && !title.trim()) setTitle(t.name);
  }

  async function save() {
    if (!title.trim()) { setError("Give the list a title."); return; }
    if (!parent) { setError("Choose a Job, Pre-Con or Pipeline deal to attach it to."); return; }
    setBusy(true); setError(null);
    try {
      const saved = editing
        ? await api<PunchList>(`/api/punch-lists/${list!.id}`, {
            method: "PATCH",
            json: {
              title, description, client_visible: isJob && clientVisible,
              ...(parent.id !== list!.parent?.id ? { parent_type: parent.type, parent_id: parent.id } : {}),
            },
          })
        : await api<PunchList>("/api/punch-lists", {
            method: "POST",
            json: { parent_type: parent.type, parent_id: parent.id, title, description, client_visible: isJob && clientVisible, template_id: templateId || null },
          });
      onSaved(saved);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? "Edit punch list" : "New punch list"} onClose={onClose} wide
      footer={<>
        <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="sm" variant="accent" onClick={() => void save()} disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {editing ? "Save" : "Create list"}
        </Button>
      </>}>
      <div className="space-y-4">
        {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        {!editing && (
          <Field label="Start from a template (optional)">
            <select className={inputCls} value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">Blank list</option>
              <optgroup label="Construction templates">
                {meta.templates.filter((t) => t.is_system).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items.length})</option>)}
              </optgroup>
              {meta.templates.some((t) => !t.is_system) && (
                <optgroup label="Saved templates">
                  {meta.templates.filter((t) => !t.is_system).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items.length})</option>)}
                </optgroup>
              )}
            </select>
          </Field>
        )}
        {template && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {template.description} Adds {template.items.length} items: {template.items.slice(0, 3).map((i) => i.title).join("; ")}…
          </p>
        )}

        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Final walkthrough — main house" />
        </Field>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Attach to</span>
          {fixedParent && !editing
            ? <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{fixedParent.label}</div>
            : <TargetPicker value={parent} onChange={setParent} />}
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Description (optional)</span>
          <RichTextEditor value={description} onChange={setDescription} placeholder="Scope of the walk, who attended, anything to know…" />
        </div>

        <label className={cn("flex items-start gap-3 rounded-lg border px-3 py-3", isJob ? "border-border" : "border-dashed border-border opacity-60")}>
          <input type="checkbox" className="mt-0.5 h-5 w-5" disabled={!isJob} checked={isJob && clientVisible} onChange={(e) => setClientVisible(e.target.checked)} />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-medium"><Eye className="h-4 w-4" /> Visible to the client</span>
            <span className="block text-xs text-muted-foreground">
              {isJob ? "The client sees this list and its progress (read-only) in their portal." : "Only lists on a Job can be shared — clients have a portal for Jobs only."}
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

export function SaveTemplateDialog({ list, onClose, onSaved }: { list: PunchList; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = React.useState(list.title);
  const [category, setCategory] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    try {
      await api("/api/punch-templates", {
        method: "POST",
        json: { name, category, items: list.items.map((i) => ({ title: i.title, location: i.location, trade: i.trade })) },
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Save as template" onClose={onClose}
      footer={<>
        <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="sm" variant="accent" onClick={() => void save()} disabled={busy || !name.trim()}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save template</Button>
      </>}>
      <div className="space-y-3">
        {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <p className="text-sm text-muted-foreground">Saves the {list.items.length} items (text, room and trade — not who they're assigned to or whether they're done) so anyone can start a list from them.</p>
        <Field label="Template name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Category (optional)"><input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Room, Closeout, Rough-In…" /></Field>
      </div>
    </Modal>
  );
}
