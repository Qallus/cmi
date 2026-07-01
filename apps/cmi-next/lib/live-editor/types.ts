// Live Page Editor — shared types for the Super Admin visual review workflow.

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const NOTE_STATUSES = ["draft", "open", "in_progress", "resolved", "archived"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const CHANGE_TYPES = [
  "copy_update",
  "section_layout_update",
  "container_spacing_update",
  "column_layout_update",
  "card_update",
  "component_update",
  "button_cta_update",
  "image_update",
  "form_update",
  "styling_update",
  "responsive_mobile_issue",
  "accessibility_issue",
  "seo_update",
  "ai_rewrite_request",
  "other",
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  copy_update: "Copy update",
  section_layout_update: "Section layout update",
  container_spacing_update: "Container spacing update",
  column_layout_update: "Column layout update",
  card_update: "Card update",
  component_update: "Component update",
  button_cta_update: "Button / CTA update",
  image_update: "Image update",
  form_update: "Form update",
  styling_update: "Styling update",
  responsive_mobile_issue: "Responsive / mobile issue",
  accessibility_issue: "Accessibility issue",
  seo_update: "SEO update",
  ai_rewrite_request: "AI rewrite request",
  other: "Other",
};

export const SELECTION_MODES = [
  "auto",
  "sections",
  "containers",
  "rows",
  "columns",
  "cards",
  "components",
  "headings",
] as const;
export type SelectionMode = (typeof SELECTION_MODES)[number];

export const SELECTION_MODE_LABELS: Record<SelectionMode, string> = {
  auto: "Auto Detect",
  sections: "Sections",
  containers: "Containers",
  rows: "Rows",
  columns: "Columns",
  cards: "Cards",
  components: "Components",
  headings: "Headings Only",
};

export type DeviceMode = "desktop" | "tablet" | "mobile";

// A detected element as produced by the in-iframe overlay and stored server-side.
export type ElementDescriptor = {
  element_ref: string;
  element_type: string;         // "h1".."h6" | "section" | "container" | ...
  element_label: string;
  heading_text: string | null;
  heading_level: number | null;
  section_order: number | null;
  parent_section_label: string | null;
  dom_selector: string | null;
  dom_path: string | null;
  css_classes: string | null;
  component_name: string | null;
  content_summary: string | null;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
};

export type ReviewSession = {
  id: string;
  page_id: string | null;
  page_url: string | null;
  page_title: string | null;
  page_slug: string;
  created_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ReviewElement = {
  id: string;
  review_session_id: string;
  page_slug: string | null;
  element_type: string | null;
  element_label: string | null;
  heading_text: string | null;
  heading_level: number | null;
  section_order: number | null;
  parent_section_label: string | null;
  dom_selector: string | null;
  dom_path: string | null;
  css_classes: string | null;
  component_name: string | null;
  element_ref: string | null;
  bounding_box_json: Record<string, unknown> | null;
  content_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewNote = {
  id: string;
  review_session_id: string;
  element_id: string | null;
  note: string;
  priority: Priority;
  status: NoteStatus;
  change_type: ChangeType | null;
  ai_generated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type SaveNoteInput = {
  page_slug: string;
  page_title: string;
  page_url: string;
  element: ElementDescriptor;
  note: string;
  priority: Priority;
  status: NoteStatus;
  change_type: ChangeType;
};
