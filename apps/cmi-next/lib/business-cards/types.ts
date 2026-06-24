// Digital Business Card types — shared by dashboard builder, API, and public page.

export type CardStatus = "draft" | "published" | "unpublished" | "archived";
export type CardMode = "standard" | "opener_slider" | "qr_only" | "nfc_landing";
export type ThemeMode = "light" | "dark" | "both";

export type LinkType =
  | "website" | "social" | "phone" | "email" | "sms" | "map"
  | "booking" | "payment" | "download" | "video" | "review" | "custom";

export type SectionType =
  | "opener" | "profile_header" | "quick_actions" | "links" | "lead_capture"
  | "video" | "qr_code" | "nfc" | "slideshow" | "steps";

export type StepItem = { id: string; title: string; description?: string };

export type MediaSettings = {
  profile_shape?: "circle" | "rounded" | "square";
  profile_outline?: boolean;
  content_align?: "center" | "left";
  use_background_image?: boolean;
};

export type AutomationAction = "notify_owner_email" | "notify_owner_sms" | "autoreply_email";

export type Automation = {
  id: string;
  trigger: "lead_submit";
  action: AutomationAction;
  enabled: boolean;
  message?: string;
};

export type SlideshowSlide = {
  id: string;
  image_url: string;
  caption?: string;
};

export type EventType =
  | "view" | "share" | "like" | "qr_scan" | "nfc_tap"
  | "link_click" | "copy_link" | "save_contact" | "lead_submit";

export type LeadStatus = "new" | "contacted" | "qualified" | "archived";

export type QrSettings = {
  foreground?: string;
  background?: string;
  size?: number;
  url?: string | null;
};

export type LeadFormField = {
  key: "name" | "email" | "phone" | "company" | "message";
  label: string;
  enabled: boolean;
  required: boolean;
};

export type LeadFormSettings = {
  enabled: boolean;
  title: string;
  description: string;
  button_label: string;
  submit_label: string;
  fields: LeadFormField[];
};

export type OpenerContent = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  primary_label?: string;
  secondary_label?: string;
  duration_seconds?: number;
};

export type BusinessCardLink = {
  id: string;
  card_id?: string;
  label: string;
  url: string;
  link_type: LinkType;
  icon: string | null;
  display_order: number;
  is_visible: boolean;
  open_in_new_tab: boolean;
  click_count: number;
};

export type BusinessCardSection = {
  id: string;
  card_id?: string;
  section_type: SectionType;
  label: string;
  content: Record<string, unknown>;
  display_order: number;
  is_visible: boolean;
  margin_top: number;
  margin_bottom: number;
  padding_top: number;
  padding_bottom: number;
};

export type BusinessCard = {
  id: string;
  staff_user_id: string | null;
  slug: string;
  card_name: string;
  status: CardStatus;
  is_public: boolean;

  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company_name: string | null;
  department: string | null;
  bio: string | null;

  profile_photo_url: string | null;
  logo_url: string | null;
  background_image_url: string | null;

  background_color: string;
  accent_color: string;
  text_color: string;
  card_mode: CardMode;
  theme_mode: ThemeMode;
  layout_template: string;

  primary_phone: string | null;
  sms_phone: string | null;
  primary_email: string | null;
  website_url: string | null;
  maps_url: string | null;
  intro_video_url: string | null;

  qr_settings: QrSettings;
  lead_form_settings: LeadFormSettings;
  media_settings: Record<string, unknown>;
  slider_pages: unknown[];
  automations: Automation[];

  nfc_status: string;
  view_count: number;
  click_count: number;

  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;

  // Relations (joined)
  business_card_links?: BusinessCardLink[];
  business_card_sections?: BusinessCardSection[];

  // Owner display info (joined from staff_users)
  owner?: { id: string; display_name: string | null; email: string | null; role_slug: string | null } | null;
};

export type BusinessCardLead = {
  id: string;
  card_id: string;
  owner_staff_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  preferred_contact: string | null;
  source: string | null;
  status: LeadStatus;
  created_at: string;
  card?: { card_name: string; slug: string; display_name: string | null } | null;
  owner?: { display_name: string | null } | null;
};

export type CardStats = {
  products: number;
  published: number;
  views: number;
  clicks: number;
  nfcReady: number;
  shares: number;
  saves: number;
  leads: number;
};

// The shape the dashboard sends to POST /api/business-cards
export type SaveCardPayload = Partial<BusinessCard> & {
  links?: BusinessCardLink[];
  sections?: BusinessCardSection[];
};
