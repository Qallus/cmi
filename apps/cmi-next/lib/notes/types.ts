// Staff Notes — shared types + vocabularies.

export const NOTE_STATUSES = ["open", "in_progress", "done", "archived"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];
export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  open: "Open", in_progress: "In Progress", done: "Done", archived: "Archived",
};

// Named colors so a note is stored as a stable key, not a raw hex the theme
// can't adapt. `swatch` is the picker chip; `bar` tints the note card edge.
export const NOTE_COLORS = [
  { key: "default", label: "Default", swatch: "#9ca3af", tint: "transparent" },
  { key: "gold",    label: "Gold",    swatch: "#b08427", tint: "rgba(176,132,39,0.12)" },
  { key: "red",     label: "Red",     swatch: "#c0432e", tint: "rgba(192,67,46,0.12)" },
  { key: "green",   label: "Green",   swatch: "#2e7d5b", tint: "rgba(46,125,91,0.12)" },
  { key: "blue",    label: "Blue",    swatch: "#3b6db0", tint: "rgba(59,109,176,0.12)" },
  { key: "purple",  label: "Purple",  swatch: "#7c5cbf", tint: "rgba(124,92,191,0.12)" },
  { key: "orange",  label: "Orange",  swatch: "#c9781f", tint: "rgba(201,120,31,0.12)" },
] as const;
export type NoteColorKey = (typeof NOTE_COLORS)[number]["key"];
export const noteColor = (key: string) => NOTE_COLORS.find((c) => c.key === key) ?? NOTE_COLORS[0];

export type NoteAttachmentKind = "image" | "audio" | "video" | "file";
export type NoteAttachment = {
  id: string;
  kind: NoteAttachmentKind;
  path: string;      // object path in the notes-media bucket
  name: string;
  url?: string;      // resolved signed URL (client-side only)
};

export type StaffNote = {
  id: string;
  author_staff_id: string | null;
  author_name: string | null;
  title: string;
  body: string;                    // Markdown
  status: NoteStatus;
  color: NoteColorKey;
  attachments: NoteAttachment[];
  linked_staff_ids: string[];
  linked_emails: string[];
  read_by: string[];
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined for display (not columns):
  linked_staff?: { id: string; name: string; email: string }[];
};

export type NoteDraft = {
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

export const NOTES_MEDIA_BUCKET = "notes-media";

export function attachmentKind(mime: string, name: string): NoteAttachmentKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (ext && ["mp3", "wav", "ogg", "m4a", "webm"].includes(ext)) return "audio";
  if (ext && ["mp4", "mov", "avi", "mkv"].includes(ext)) return "video";
  return "file";
}
