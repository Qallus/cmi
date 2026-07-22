"use client";

import * as React from "react";
import { FileIcon, Film, ImageIcon, Loader2, Mic, Paperclip, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { cn } from "@/lib/utils";
import {
  NOTE_COLORS, NOTE_STATUSES, NOTE_STATUS_LABELS, noteColor,
  type NoteAttachment, type NoteColorKey, type NoteStatus, type StaffNote,
} from "@/lib/notes/types";
import { apiNoteMediaUrl, uploadNoteFile, type StaffOption } from "./notes-api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NoteEditorValue = {
  title: string;
  body: string;
  status: NoteStatus;
  color: NoteColorKey;
  attachments: NoteAttachment[];
  linked_staff_ids: string[];
  linked_emails: string[];
  due_date: string | null;
  notify: boolean;
};

export function NoteEditor({
  note, staffOptions, canDelete, onSave, onDelete, onClose,
}: {
  note: StaffNote | null;
  staffOptions: StaffOption[];
  canDelete: boolean;
  onSave: (v: NoteEditorValue) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = React.useState(note?.title ?? "");
  const [body, setBody] = React.useState(note?.body ?? "");
  const [status, setStatus] = React.useState<NoteStatus>(note?.status ?? "open");
  const [color, setColor] = React.useState<NoteColorKey>(note?.color ?? "default");
  const [attachments, setAttachments] = React.useState<NoteAttachment[]>(note?.attachments ?? []);
  const [linkedStaff, setLinkedStaff] = React.useState<string[]>(note?.linked_staff_ids ?? []);
  const [emails, setEmails] = React.useState<string[]>(note?.linked_emails ?? []);
  const [emailInput, setEmailInput] = React.useState("");
  const [due, setDue] = React.useState(note?.due_date ?? "");
  const [notify, setNotify] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [thumbs, setThumbs] = React.useState<Record<string, string>>({});
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Resolve signed URLs for existing image attachments (thumbnails).
  React.useEffect(() => {
    for (const a of attachments) {
      if (a.kind === "image" && a.path && !thumbs[a.path]) {
        apiNoteMediaUrl(a.path).then((url) => setThumbs((t) => ({ ...t, [a.path]: url }))).catch(() => {});
      }
    }
  }, [attachments, thumbs]);

  function addEmail() {
    const e = emailInput.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL_RE.test(e)) { setError("Enter a valid email address."); return; }
    if (!emails.includes(e)) setEmails((prev) => [...prev, e]);
    setEmailInput(""); setError("");
  }

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setUploading(true); setError("");
    for (const file of files) {
      try {
        const att = await uploadNoteFile(file);
        setAttachments((prev) => [...prev, att]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    }
    setUploading(false);
  }

  async function handleSave() {
    setBusy(true); setError("");
    try {
      await onSave({
        title: title.trim(), body, status, color, attachments,
        linked_staff_ids: linkedStaff, linked_emails: emails,
        due_date: due || null, notify,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the note.");
      setBusy(false);
    }
  }

  const comboOptions = staffOptions.map((s) => ({ id: s.id, label: s.name }));

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={note ? "Edit note" : "New note"}>
      <div className="relative my-6 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl" style={{ borderTopColor: noteColor(color).swatch, borderTopWidth: 3 }}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{note ? "Edit Note" : "New Note"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div>
            <label htmlFor="note-title" className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
            <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
          </div>

          <div>
            <label htmlFor="note-body" className="mb-1 block text-xs font-medium text-muted-foreground">Body <span className="text-muted-foreground/70">(Markdown supported)</span></label>
            <textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6}
              placeholder="Write your note… links, lists, and **formatting** with Markdown."
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="note-status" className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <Select id="note-status" value={status} onChange={(e) => setStatus(e.target.value as NoteStatus)}>
                {NOTE_STATUSES.map((s) => <option key={s} value={s}>{NOTE_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="note-due" className="mb-1 block text-xs font-medium text-muted-foreground">Due date</label>
              <Input id="note-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Color</span>
            <div className="flex flex-wrap gap-2">
              {NOTE_COLORS.map((c) => (
                <button key={c.key} type="button" onClick={() => setColor(c.key)} title={c.label} aria-label={c.label} aria-pressed={color === c.key}
                  className={cn("h-7 w-7 rounded-full border-2 transition", color === c.key ? "border-foreground" : "border-transparent hover:border-border")}
                  style={{ background: c.swatch }} />
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Link staff</span>
            <MultiCombobox options={comboOptions} value={linkedStaff} onChange={setLinkedStaff} placeholder="Search teammates…" />
          </div>

          <div>
            <label htmlFor="note-email" className="mb-1 block text-xs font-medium text-muted-foreground">Link other people (any email)</label>
            <div className="flex gap-2">
              <Input id="note-email" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} placeholder="name@example.com" />
              <Button type="button" size="sm" variant="outline" onClick={addEmail}>Add</Button>
            </div>
            {emails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                    {e}
                    <button type="button" onClick={() => setEmails((prev) => prev.filter((x) => x !== e))} aria-label={`Remove ${e}`} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Attachments</span>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-50">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Add files
              </button>
            </div>
            <input ref={fileRef} type="file" multiple hidden accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.ppt,.pptx,.key" onChange={(e) => void onFiles(e.target.files)} />
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Images, audio, video, slides, PDFs, and files.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-md border border-border bg-background p-1.5">
                    {a.kind === "image" && thumbs[a.path]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={thumbs[a.path]} alt={a.name} className="h-9 w-9 shrink-0 rounded object-cover" />
                      : <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-muted text-muted-foreground">{attachIcon(a.kind)}</span>}
                    <span className="min-w-0 flex-1 truncate text-[11px]">{a.name}</span>
                    <button type="button" onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.name}`} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Notify linked people (in-app + email)
          </label>

          {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          {note && canDelete
            ? <Button type="button" size="sm" variant="outline" onClick={() => void onDelete()} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            : <span />}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" size="sm" variant="accent" onClick={() => void handleSave()} disabled={busy || uploading}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save Note
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function attachIcon(kind: NoteAttachment["kind"]) {
  const cls = "h-4 w-4";
  if (kind === "image") return <ImageIcon className={cls} />;
  if (kind === "audio") return <Mic className={cls} />;
  if (kind === "video") return <Film className={cls} />;
  return <FileIcon className={cls} />;
}
