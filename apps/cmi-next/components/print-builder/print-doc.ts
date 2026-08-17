import { blocksToInnerHtml } from "@/components/email-builder/renderer";
import type { EmailBlock } from "@/components/email-builder/types";
import { pageDims, type PageSizeKey, type Orientation } from "./page-sizes";

// A self-contained, print-ready HTML document sized to the chosen page. Used for
// the viewer preview (iframe) and for the browser Print / Save-as-PDF window.
export function printableHtml(
  blocks: EmailBlock[],
  opts: { pageSize: PageSizeKey; orientation: Orientation; widthIn?: number | null; heightIn?: number | null },
): string {
  const { wIn, hIn } = pageDims(opts.pageSize, opts.orientation, opts.widthIn, opts.heightIn);
  const rows = blocksToInnerHtml(blocks);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: ${wIn}in ${hIn}in; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, Helvetica, sans-serif; }
  .cmi-page { width: ${wIn}in; min-height: ${hIn}in; margin: 0 auto; background: #ffffff; overflow: hidden; position: relative; }
  table { border-collapse: collapse; }
  img { max-width: 100%; }
</style>
</head>
<body>
  <div class="cmi-page">
    <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>
  </div>
</body>
</html>`;
}

// Open the print document in a new window and trigger the browser print dialog
// (where the user can pick a printer or "Save as PDF").
export function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) { alert("Please allow pop-ups to print or save this document as a PDF."); return; }
  w.document.open();
  w.document.write(`${html}<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},300);});<\/script>`);
  w.document.close();
}
