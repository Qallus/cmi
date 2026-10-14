"use client";

// A daily log's text. New logs are rich text (HTML from the editor); older
// ones and phone captures are plain text — show either correctly.
import * as React from "react";
import { cn } from "@/lib/utils";
import { htmlToText, sanitizeHtml } from "@/lib/notes/html";

const looksLikeHtml = (s: string) => /<(p|br|ul|ol|li|h[1-3]|strong|em|b|i|u|a|div)\b/i.test(s);

export function LogNotes({ notes, clamp, className }: { notes: string | null | undefined; clamp?: boolean; className?: string }) {
  if (!notes?.trim()) return null;
  if (clamp) {
    // Card previews: plain text, a few lines.
    return <p className={cn("line-clamp-3 text-sm text-muted-foreground", className)}>{looksLikeHtml(notes) ? htmlToText(notes) : notes}</p>;
  }
  return looksLikeHtml(notes)
    ? <div className={cn("prose prose-sm max-w-none text-sm text-muted-foreground", className)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(notes) }} />
    : <p className={cn("whitespace-pre-wrap text-sm text-muted-foreground", className)}>{notes}</p>;
}
