export type BlockType =
  | "header" | "heading" | "text" | "button"
  | "image" | "divider" | "spacer" | "footer"
  | "columns" | "list" | "html";

/** How a list marks its items. `icon` uses whatever character is set. */
export type ListStyle = "bullet" | "number" | "check" | "dash" | "arrow" | "icon";

export const LIST_MARKERS: Record<Exclude<ListStyle, "number" | "icon">, string> = {
  bullet: "•",
  check: "✓",
  dash: "–",
  arrow: "→",
};

export interface ColumnItem {
  id: string;
  type: "image" | "text" | "button" | "heading" | "list";
  // image
  src?: string;
  alt?: string;
  link?: string;
  // text
  content?: string;
  // heading
  text?: string;
  level?: "h1" | "h2" | "h3";
  heading_size?: number;
  heading_color?: string;
  // button
  label?: string;
  url?: string;
  btn_bg?: string;
  btn_color?: string;
  btn_radius?: number;
  // list — a column can hold one, which is how a long list splits across
  // two or three columns instead of running down the page.
  items?: string[];
  list_style?: ListStyle;
  list_icon?: string;
  marker_color?: string;
  // shared
  font_size?: number;
  line_height?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

export interface EmailBlock {
  id: string;
  type: BlockType;
  // Header
  logo_url?: string;
  bg_color?: string;
  logo_width?: number;
  // Heading
  text?: string;
  level?: "h1" | "h2" | "h3";
  color?: string;
  font_size?: number;
  /** Multiplier, e.g. 1.6. Unset falls back to a per-block-type default. */
  line_height?: number;
  align?: "left" | "center" | "right";
  // Text / paragraph
  content?: string;
  // Button
  label?: string;
  url?: string;
  btn_bg?: string;
  btn_color?: string;
  btn_radius?: number;
  // Image
  src?: string;
  alt?: string;
  img_width?: number;
  link?: string;
  // Divider
  border_color?: string;
  thickness?: number;
  // Spacer
  height?: number;
  // Footer
  company?: string;
  address?: string;
  disclaimer?: string;
  // Columns
  col_count?: 2 | 3 | 4;
  columns?: ColumnItem[];
  // List
  items?: string[];
  list_style?: ListStyle;
  /** The character used when list_style is "icon". */
  list_icon?: string;
  marker_color?: string;
  item_spacing?: number;
  // Raw HTML block
  html?: string;
  // Section / spacing overrides (all blocks)
  section_bg?: string;
  pad_top?: number;
  pad_bottom?: number;
  /** Legacy combined left/right padding; pad_left/pad_right take precedence. */
  pad_x?: number;
  pad_left?: number;
  pad_right?: number;
}

/**
 * Document-level settings: the page around the blocks.
 *
 * Every field is optional, and an empty object means the values the
 * renderer has always hard-coded — so a template saved before this existed
 * renders identically.
 */
export interface EmailSettings {
  /** Content width in px. 560 was the old fixed value; 600 is the common max. */
  width?: number;
  /** Behind the email — the letterboxing colour. */
  page_bg?: string;
  /** The email body itself. */
  content_bg?: string;
  font_family?: string;
  font_size?: number;
  text_color?: string;
  link_color?: string;
  /** Padding around the whole email, inside the page background. */
  page_pad_y?: number;
  page_pad_x?: number;
  corner_radius?: number;
}

export const EMAIL_DEFAULTS: Required<EmailSettings> = {
  width: 560,
  page_bg: "#f4f4f4",
  content_bg: "#ffffff",
  font_family: "Arial, sans-serif",
  font_size: 15,
  text_color: "#4b5563",
  link_color: "#C87A3A",
  page_pad_y: 40,
  page_pad_x: 20,
  corner_radius: 8,
};

/** The fonts that survive an email client. No webfonts. */
export const EMAIL_FONTS: { value: string; label: string }[] = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "'Segoe UI', Roboto, Arial, sans-serif", label: "Segoe UI" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Verdana, sans-serif", label: "Tahoma" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "'Courier New', Courier, monospace", label: "Courier New" },
];

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  preview_text: string;
  builder_type: "visual" | "html";
  blocks: EmailBlock[];
  settings: EmailSettings;
  html: string;
  trigger_event: string | null;
  status: "draft" | "active";
  created_at: string;
  updated_at: string;
}

export const TRIGGER_EVENTS: { value: string; label: string }[] = [
  { value: "", label: "None (manual send)" },
  { value: "user_invited", label: "User Invited" },
  { value: "booking_created", label: "Booking Created" },
  { value: "booking_confirmed", label: "Booking Confirmed" },
  { value: "project_created", label: "Project Created" },
  { value: "project_status_changed", label: "Project Status Changed" },
  { value: "quote_submitted", label: "Quote Submitted" },
  { value: "quote_approved", label: "Quote Approved" },
  { value: "document_shared", label: "Document Shared" },
  { value: "billing_invoice", label: "Invoice Sent" },
];
