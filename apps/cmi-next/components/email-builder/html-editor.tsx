"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function HtmlEditor({ html, onChange }: {
  html: string;
  onChange: (html: string) => void;
}) {
  const [preview, setPreview] = React.useState(true);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewSrc, setPreviewSrc] = React.useState(html);

  function handleChange(value: string) {
    onChange(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewSrc(value), 400);
  }

  React.useEffect(() => {
    setPreviewSrc(html);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <span className="text-xs text-muted-foreground">
          Edit HTML directly. Preview updates automatically.
        </span>
        <button
          type="button"
          onClick={() => setPreview(v => !v)}
          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
        >
          {preview ? "Hide Preview" : "Show Preview"}
        </button>
      </div>

      {/* Split pane */}
      <div className={cn("flex flex-1 overflow-hidden", preview ? "divide-x divide-border" : "")}>
        {/* Code editor */}
        <div className={cn("flex flex-col overflow-hidden", preview ? "w-1/2" : "flex-1")}>
          <div className="border-b border-border bg-muted/30 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            HTML Source
          </div>
          <textarea
            className="flex-1 resize-none bg-[#1e1e2e] p-4 font-mono text-[13px] leading-relaxed text-[#cdd6f4] outline-none"
            value={html}
            onChange={e => handleChange(e.target.value)}
            spellCheck={false}
            placeholder={DEFAULT_HTML}
          />
        </div>

        {/* Preview pane */}
        {preview && (
          <div className="flex w-1/2 flex-col overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Preview
            </div>
            <div className="flex-1 overflow-auto bg-[#f4f4f4] p-4">
              <iframe
                srcDoc={previewSrc || DEFAULT_HTML}
                className="mx-auto block h-full w-full max-w-[560px] rounded border border-border bg-white"
                title="HTML Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:#111;padding:28px 40px;text-align:center;">
            <img src="https://my.constructedmatter.com/brand/CMI_Line_Logo_White.svg" alt="CMI" width="180" style="display:block;margin:0 auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 16px;font-size:24px;color:#111;">Hello!</h1>
            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">Your email content goes here.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
