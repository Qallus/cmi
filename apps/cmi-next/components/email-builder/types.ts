export type BlockType =
  | "header" | "heading" | "text" | "button"
  | "image" | "divider" | "spacer" | "footer"
  | "columns";

export interface ColumnItem {
  id: string;
  type: "image" | "text" | "button" | "heading";
  // image
  src?: string;
  alt?: string;
  link?: string;
  // text
  content?: string;
  // heading
  text?: string;
  level?: "h1" | "h2" | "h3";
  // button
  label?: string;
  url?: string;
  btn_bg?: string;
  btn_color?: string;
  btn_radius?: number;
  // shared
  font_size?: number;
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
  col_count?: 2 | 3;
  columns?: ColumnItem[];
  // Section / spacing overrides (all blocks)
  section_bg?: string;
  pad_top?: number;
  pad_bottom?: number;
  pad_x?: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  preview_text: string;
  builder_type: "visual" | "html";
  blocks: EmailBlock[];
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
