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
  "new_section",
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
  new_section: "New section (insert)",
  ai_rewrite_request: "AI rewrite request",
  other: "Other",
};

// "Addition" requests (the + between sections). What kind of thing to add, and —
// when it's a component — which ShadCN component to base it on.
export const INSERT_KINDS = ["section", "row", "column", "card", "component"] as const;
export type InsertKind = (typeof INSERT_KINDS)[number];
export const INSERT_KIND_LABELS: Record<InsertKind, string> = {
  section: "Section",
  row: "Row",
  column: "Column",
  card: "Card",
  component: "Component (ShadCN)",
};

// Curated ShadCN UI primitives + common composite blocks a marketing page uses.
// (Future version: replace this flat list with a visual component-library picker.)
export const SHADCN_COMPONENTS = [
  "Accordion", "Alert", "Avatar", "Badge", "Button", "Card", "Carousel", "Dialog",
  "Tabs", "Table", "Tooltip", "Popover", "Sheet", "Select", "Input", "Textarea",
  "Form", "Navigation Menu", "Breadcrumb", "Pagination", "Progress", "Separator",
  "Skeleton", "Hero block", "CTA block", "Feature grid", "Stats block",
  "Testimonial block", "Pricing table", "FAQ (Accordion)", "Gallery",
  "Logo cloud", "Newsletter signup", "Contact form",
] as const;

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

// Session-level status doubles as the "edit request" status shown in the gallery.
export const SESSION_STATUSES = ["open", "in_progress", "resolved", "archived"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Complete",
  archived: "Archived",
};

export type ReviewSession = {
  id: string;
  page_id: string | null;
  page_url: string | null;
  page_title: string | null;
  page_slug: string;
  created_by: string | null;
  status: string;
  requester_name: string | null;
  requester_email: string | null;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
};

// Row shown in the Saved Reviews gallery.
export type SessionSummary = {
  session: ReviewSession;
  note_count: number;
  open_count: number;
  resolved_count: number;
  top_priority: Priority | null;
  last_activity: string;
};

export type ReviewNotification = {
  id: string;
  review_session_id: string;
  to_email: string;
  to_name: string | null;
  subject: string | null;
  status_snapshot: string | null;
  created_at: string;
  error: string | null;
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
  insert_kind: InsertKind | null;
  component_name: string | null;
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
  insert_kind?: InsertKind | null;
  component_name?: string | null;
};
