"use client";

import * as React from "react";
import { Download, FileText, Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseDelimited } from "@/lib/csv";
import type { FileRow } from "@/lib/files/types";

// What we can show inline, worked out from the MIME type and the extension
// (browsers often report text files as application/octet-stream).
export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "table" | "office" | "none";

const TEXT_EXT = new Set(["txt", "log", "md", "markdown", "json", "xml", "yml", "yaml", "ini", "conf", "csv", "tsv", "html", "htm", "css", "js", "ts", "tsx", "jsx", "sql", "sh", "bat", "py", "rb", "go", "java", "c", "h", "cpp", "rs", "toml", "env", "srt", "vtt", "gcode"]);
const TABLE_EXT = new Set(["csv", "tsv"]);
const OFFICE_EXT = new Set(["xlsx", "xls", "xlsm", "docx", "doc", "pptx", "ppt", "odt", "ods", "odp", "pages", "numbers", "key"]);
// Text preview is fetched into memory, so keep a sane ceiling.
export const TEXT_PREVIEW_MAX = 2 * 1024 * 1024;

export const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

export function previewKind(file: Pick<FileRow, "name" | "mime_type" | "size_bytes">): PreviewKind {
  const mime = (file.mime_type ?? "").toLowerCase();
  const ext = extOf(file.name);
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp", "ico"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (TABLE_EXT.has(ext) || mime === "text/csv") return "table";
  if (mime.startsWith("text/") || mime === "application/json" || TEXT_EXT.has(ext)) return "text";
  if (OFFICE_EXT.has(ext)) return "office";
  return "none";
}

export function CloudPreview({ file, canDownload = true, onDownload, onClose }: {
  file: FileRow;
  canDownload?: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const kind = previewKind(file);
  const src = `/api/files/${file.id}/download`;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={file.name}
        className={cn("relative z-10 flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl transition-[max-width,height]",
          expanded ? "h-[95vh] max-w-[95vw]" : "max-h-[90vh] max-w-4xl")}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{fmtSize(file.size_bytes)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {kind !== "none" && kind !== "office" && (
              <button type="button" aria-label={expanded ? "Collapse" : "Expand"} title={expanded ? "Collapse" : "Expand"}
                onClick={() => setExpanded((v) => !v)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}
            {canDownload && (
              <button type="button" aria-label="Download" title="Download" onClick={onDownload} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Download className="h-4 w-4" />
              </button>
            )}
            <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/20">
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element -- streamed from storage, not optimizable
            <img src={src} alt={file.name} className="mx-auto max-h-full max-w-full object-contain p-2" />
          )}
          {kind === "pdf" && <iframe src={src} title={file.name} className={cn("w-full border-0 bg-white", expanded ? "h-full" : "h-[70vh]")} />}
          {kind === "video" && <video src={src} controls className="mx-auto max-h-full w-full max-w-full bg-black" />}
          {kind === "audio" && <div className="p-8"><audio src={src} controls className="w-full" /></div>}
          {(kind === "text" || kind === "table") && <TextPreview file={file} src={src} table={kind === "table"} />}
          {(kind === "office" || kind === "none") && (
            <Unsupported file={file} kind={kind} canDownload={canDownload} onDownload={onDownload} />
          )}
        </div>
      </div>
    </div>
  );
}

// Text, code, JSON and CSV/TSV are fetched and rendered inline.
function TextPreview({ file, src, table }: { file: FileRow; src: string; table: boolean }) {
  const [text, setText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const tooBig = (file.size_bytes ?? 0) > TEXT_PREVIEW_MAX;

  React.useEffect(() => {
    if (tooBig) return;
    let alive = true;
    fetch(src)
      .then((r) => { if (!r.ok) throw new Error(`Couldn't load this file (${r.status}).`); return r.text(); })
      .then((t) => { if (alive) setText(t); })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [src, tooBig]);

  if (tooBig) return <Note>This file is too large to preview here ({fmtSize(file.size_bytes)}). Download it to view.</Note>;
  if (error) return <Note>{error}</Note>;
  if (text === null) return <Note>Loading…</Note>;

  if (table) {
    const rows = parseDelimited(text, extOf(file.name) === "tsv" ? "\t" : ",");
    if (!rows.length) return <Note>This file looks empty.</Note>;
    const [head, ...body] = rows;
    const shown = body.slice(0, 500);
    return (
      <div className="overflow-auto p-3">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-card">
            <tr>{head.map((h, i) => <th key={i} className="border border-border px-2 py-1.5 text-left font-semibold">{h || <span className="text-muted-foreground">—</span>}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="odd:bg-muted/30">
                {head.map((_, c) => <td key={c} className="border border-border px-2 py-1 align-top">{r[c] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {body.length > shown.length && (
          <p className="mt-2 text-xs text-muted-foreground">Showing the first {shown.length.toLocaleString()} of {body.length.toLocaleString()} rows. Download for the rest.</p>
        )}
      </div>
    );
  }

  // Normalize Windows line endings so they don't show as stray characters.
  const clean = text.replace(/\r\n?/g, "\n");
  const pretty = file.name.toLowerCase().endsWith(".json") ? safeJson(clean) : clean;
  return <pre className="min-h-full whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-foreground">{pretty}</pre>;
}

function Unsupported({ file, kind, canDownload, onDownload }: { file: FileRow; kind: PreviewKind; canDownload: boolean; onDownload: () => void }) {
  const ext = extOf(file.name).toUpperCase();
  return (
    <div className="grid h-full min-h-[40vh] place-items-center p-8 text-center">
      <div className="space-y-3">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
        <div className="text-sm font-medium">{ext ? `${ext} file` : "This file type"} can&apos;t be shown here yet</div>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
          {kind === "office"
            ? "Office documents open in Excel, Word or PowerPoint. Download it to view or edit."
            : "Download it to open in whichever app handles this file type."}
        </p>
        <div className="text-xs text-muted-foreground">{fmtSize(file.size_bytes)} · {file.mime_type || "unknown type"}</div>
        {canDownload && <Button size="sm" variant="accent" onClick={onDownload}><Download className="h-3.5 w-3.5" /> Download</Button>}
      </div>
    </div>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="grid h-full min-h-[30vh] place-items-center p-8 text-center text-sm text-muted-foreground">{children}</div>
);

function safeJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

export function fmtSize(bytes: number | null | undefined): string {
  const n = bytes ?? 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
