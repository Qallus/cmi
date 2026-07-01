// Live Page Editor — export builders. Produces export-ready structured data,
// a human-readable Markdown brief, and an AI-readable brief for Bolt.
//
// PDF generation is intentionally not wired here (no existing PDF utility in the
// app). Everything is built behind these pure functions so a `pdf` file_type can
// be added later without touching callers.
import { CHANGE_TYPE_LABELS, type ChangeType, type ReviewElement, type ReviewNote, type ReviewSession } from "./types";

export type ExportNote = {
  note: string;
  priority: string;
  status: string;
  change_type: string | null;
  change_type_label: string | null;
  ai_generated: boolean;
  element: {
    element_type: string | null;
    element_label: string | null;
    heading_text: string | null;
    heading_level: number | null;
    parent_section_label: string | null;
    dom_selector: string | null;
    element_ref: string | null;
  } | null;
};

export type StructuredExport = {
  page_title: string | null;
  page_url: string | null;
  page_slug: string;
  date_created: string;
  created_by: string | null;
  total_elements_reviewed: number;
  total_notes: number;
  sections: Array<{ section: string; notes: ExportNote[] }>;
  notes: ExportNote[];
  ai_instruction: string;
};

const AI_INSTRUCTION =
  "These are Super Admin review notes for a single page. Propose changes as DRAFTS only. " +
  "Scope every change to the referenced element (heading, section, container, etc.). " +
  "Do not publish, do not make destructive edits, and do not touch elements that are not referenced. " +
  "For hardcoded (non-CMS) sections, mark the change as 'manual implementation required'.";

function changeTypeLabel(ct: string | null): string | null {
  if (!ct) return null;
  return CHANGE_TYPE_LABELS[ct as ChangeType] ?? ct;
}

export function buildStructuredExport(bundle: {
  session: ReviewSession; elements: ReviewElement[]; notes: ReviewNote[];
}): StructuredExport {
  const elementById = new Map(bundle.elements.map((e) => [e.id, e]));

  const exportNotes: ExportNote[] = bundle.notes.map((n) => {
    const el = n.element_id ? elementById.get(n.element_id) ?? null : null;
    return {
      note: n.note,
      priority: n.priority,
      status: n.status,
      change_type: n.change_type,
      change_type_label: changeTypeLabel(n.change_type),
      ai_generated: n.ai_generated,
      element: el ? {
        element_type: el.element_type,
        element_label: el.element_label,
        heading_text: el.heading_text,
        heading_level: el.heading_level,
        parent_section_label: el.parent_section_label,
        dom_selector: el.dom_selector,
        element_ref: el.element_ref,
      } : null,
    };
  });

  // Group by parent section (falls back to "Page").
  const sectionMap = new Map<string, ExportNote[]>();
  for (const en of exportNotes) {
    const key = en.element?.parent_section_label
      || (en.element?.element_type?.startsWith("section") ? (en.element.element_label ?? "Section") : null)
      || "Page";
    const list = sectionMap.get(key) ?? [];
    list.push(en);
    sectionMap.set(key, list);
  }

  return {
    page_title: bundle.session.page_title,
    page_url: bundle.session.page_url,
    page_slug: bundle.session.page_slug,
    date_created: bundle.session.created_at,
    created_by: bundle.session.created_by,
    total_elements_reviewed: bundle.elements.length,
    total_notes: bundle.notes.length,
    sections: Array.from(sectionMap.entries()).map(([section, notes]) => ({ section, notes })),
    notes: exportNotes,
    ai_instruction: AI_INSTRUCTION,
  };
}

function elementTypeLabel(en: ExportNote): string {
  const t = en.element?.element_type ?? "element";
  if (/^h[1-6]$/.test(t)) return `${t.toUpperCase()} Heading`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Human-readable Markdown brief. */
export function buildMarkdown(data: StructuredExport): string {
  const lines: string[] = [];
  lines.push(`# Page Review — ${data.page_title ?? data.page_slug}`);
  lines.push("");
  lines.push(`- **Page:** ${data.page_title ?? data.page_slug}`);
  if (data.page_url) lines.push(`- **URL:** ${data.page_url}`);
  lines.push(`- **Date created:** ${new Date(data.date_created).toLocaleString()}`);
  if (data.created_by) lines.push(`- **Created by:** ${data.created_by}`);
  lines.push(`- **Elements reviewed:** ${data.total_elements_reviewed}`);
  lines.push(`- **Total notes:** ${data.total_notes}`);
  lines.push("");

  for (const group of data.sections) {
    lines.push(`## Section: ${group.section}`);
    lines.push("");
    for (const en of group.notes) {
      lines.push(`### ${elementTypeLabel(en)}${en.element?.heading_text ? ` — ${en.element.heading_text}` : ""}`);
      if (en.element?.element_ref) lines.push(`- Element ref: \`${en.element.element_ref}\``);
      if (en.element?.dom_selector) lines.push(`- Selector: \`${en.element.dom_selector}\``);
      lines.push(`- Requested change: ${en.note}`);
      if (en.change_type_label) lines.push(`- Change type: ${en.change_type_label}`);
      lines.push(`- Priority: ${en.priority}`);
      lines.push(`- Status: ${en.status}`);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`**AI Instruction:** ${data.ai_instruction}`);
  return lines.join("\n");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PRIORITY_COLOR: Record<string, string> = {
  low: "#64748b", medium: "#2563eb", high: "#d97706", urgent: "#dc2626",
};

/**
 * Self-contained printable HTML report — a visual reference the reviewer can
 * "Save as PDF" from the browser print dialog (no PDF dependency required).
 * Good as a human/stakeholder artifact; the text brief is what Bolt consumes.
 */
export function buildPrintableHtml(data: StructuredExport): string {
  const rows = data.sections.map((group) => {
    const notes = group.notes.map((en) => {
      const color = PRIORITY_COLOR[en.priority] ?? "#64748b";
      return `
      <div class="note">
        <div class="note-head">
          <span class="badge" style="background:${color}">${esc(en.priority.toUpperCase())}</span>
          <span class="etype">${esc(elementTypeLabel(en))}</span>
          ${en.change_type_label ? `<span class="ctype">${esc(en.change_type_label)}</span>` : ""}
          <span class="status">${esc(en.status)}</span>
        </div>
        ${en.element?.heading_text ? `<div class="etext">${esc(en.element.heading_text)}</div>` : ""}
        <div class="body">${esc(en.note)}</div>
        ${en.element?.element_ref ? `<div class="ref">ref: ${esc(en.element.element_ref)}</div>` : ""}
        ${en.element?.dom_selector ? `<div class="ref">selector: ${esc(en.element.dom_selector)}</div>` : ""}
      </div>`;
    }).join("");
    return `<section class="group"><h2>${esc(group.section)}</h2>${notes}</section>`;
  }).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Page Review — ${esc(data.page_title ?? data.page_slug)}</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;padding:32px;background:#fff}
  header{border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px}
  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#64748b}
  h1{font-size:22px;margin:4px 0 0}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 24px;margin:16px 0 8px;font-size:12px;color:#475569}
  .meta b{color:#0f172a}
  .group{margin-top:20px;page-break-inside:avoid}
  .group>h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  .note{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:8px 0;page-break-inside:avoid}
  .note-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .badge{color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px}
  .etype{font-weight:600;font-size:12px}
  .ctype,.status{font-size:11px;color:#64748b}
  .status{margin-left:auto;text-transform:capitalize}
  .etext{font-weight:600;margin-top:6px}
  .body{margin-top:4px}
  .ref{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#94a3b8;margin-top:4px;word-break:break-all}
  .ai{margin-top:24px;border-top:1px dashed #cbd5e1;padding-top:12px;font-size:12px;color:#475569}
  @media print{body{padding:0}.no-print{display:none}}
</style></head>
<body>
  <header>
    <div class="eyebrow">CMI · Live Page Editor Review</div>
    <h1>${esc(data.page_title ?? data.page_slug)}</h1>
  </header>
  <div class="meta">
    ${data.page_url ? `<div><b>URL</b><br>${esc(data.page_url)}</div>` : ""}
    <div><b>Date</b><br>${esc(new Date(data.date_created).toLocaleString())}</div>
    ${data.created_by ? `<div><b>Created by</b><br>${esc(data.created_by)}</div>` : ""}
    <div><b>Elements reviewed</b><br>${data.total_elements_reviewed}</div>
    <div><b>Total notes</b><br>${data.total_notes}</div>
  </div>
  ${rows || '<p style="color:#94a3b8">No notes recorded.</p>'}
  <div class="ai"><b>AI Instruction:</b> ${esc(data.ai_instruction)}</div>
</body></html>`;
}

/** Compact AI-readable brief for Bolt (plain text, one block per note). */
export function buildAiBrief(data: StructuredExport): string {
  const lines: string[] = [];
  lines.push(`Page: ${data.page_title ?? data.page_slug}`);
  if (data.page_url) lines.push(`Page URL: ${data.page_url}`);
  lines.push(`Total notes: ${data.total_notes}`);
  lines.push("");
  data.notes.forEach((en, i) => {
    lines.push(`--- Note ${i + 1} ---`);
    lines.push(`Section: ${en.element?.parent_section_label ?? "Page"}`);
    lines.push(`Element Type: ${elementTypeLabel(en)}`);
    if (en.element?.heading_text) lines.push(`Element Text: ${en.element.heading_text}`);
    if (en.element?.element_ref) lines.push(`Element Ref: ${en.element.element_ref}`);
    lines.push(`Requested Change: ${en.note}`);
    if (en.change_type_label) lines.push(`Change Type: ${en.change_type_label}`);
    lines.push(`Priority: ${en.priority}`);
    lines.push("");
  });
  lines.push(`AI Instruction: ${data.ai_instruction}`);
  return lines.join("\n");
}
