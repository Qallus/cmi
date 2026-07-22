"use client";

import { attachmentKind, type NoteAttachment, type StaffNote } from "@/lib/notes/types";

export type StaffOption = { id: string; name: string; email: string };

async function jsonOk<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || (data as { error?: string }).error) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export async function apiListNotes(): Promise<{ notes: StaffNote[]; me: { id: string; name: string | null }; staffOptions: StaffOption[] }> {
  return jsonOk(await fetch("/api/notes", { cache: "no-store" }));
}

export async function apiCreateNote(input: Record<string, unknown>): Promise<StaffNote> {
  return (await jsonOk<{ note: StaffNote }>(await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }))).note;
}

export async function apiUpdateNote(id: string, input: Record<string, unknown>): Promise<StaffNote> {
  return (await jsonOk<{ note: StaffNote }>(await fetch(`/api/notes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }))).note;
}

export async function apiDeleteNote(id: string): Promise<void> {
  await jsonOk(await fetch(`/api/notes/${id}`, { method: "DELETE" }));
}

export async function apiImportNotes(notes: unknown[]): Promise<number> {
  return (await jsonOk<{ imported: number }>(await fetch("/api/notes/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) }))).imported;
}

export async function apiNoteMediaUrl(path: string): Promise<string> {
  return (await jsonOk<{ url: string }>(await fetch("/api/notes/media-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) }))).url;
}

/** Upload one file to the notes bucket via a signed URL; returns an attachment. */
export async function uploadNoteFile(file: File): Promise<NoteAttachment> {
  const { path, signedUrl } = await jsonOk<{ path: string; signedUrl: string; token: string }>(
    await fetch("/api/notes/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name }) }),
  );
  const put = await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" } });
  if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
  return { id: crypto.randomUUID(), kind: attachmentKind(file.type, file.name), path, name: file.name };
}
