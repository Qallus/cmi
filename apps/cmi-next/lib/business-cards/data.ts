import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  BusinessCard, BusinessCardLead, BusinessCardLink, BusinessCardSection,
  CardStats, EventType, SaveCardPayload, SectionType,
} from "./types";

const CARD_SELECT = "*, owner:staff_users(id, display_name, email, role_slug)";

const CARD_COLUMNS = [
  "staff_user_id", "slug", "card_name", "status", "is_public",
  "display_name", "first_name", "last_name", "job_title", "company_name", "department", "bio",
  "profile_photo_url", "logo_url", "background_image_url",
  "background_color", "accent_color", "text_color", "card_mode", "theme_mode", "layout_template",
  "primary_phone", "sms_phone", "primary_email", "website_url", "maps_url", "intro_video_url",
  "qr_settings", "lead_form_settings", "media_settings", "slider_pages", "automations",
  "nfc_status", "published_at", "archived_at",
] as const;

export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "card";
}

export function defaultSections(): Omit<BusinessCardSection, "id" | "card_id">[] {
  const base = [
    { section_type: "opener" as SectionType,         label: "Opener / splash",   visible: false },
    { section_type: "profile_header" as SectionType, label: "Profile header",    visible: true },
    { section_type: "quick_actions" as SectionType,  label: "Quick actions",     visible: true },
    { section_type: "links" as SectionType,          label: "Links & socials",   visible: true },
    { section_type: "lead_capture" as SectionType,   label: "Lead capture",      visible: true },
    { section_type: "video" as SectionType,          label: "Intro video",       visible: false },
    { section_type: "qr_code" as SectionType,        label: "QR code",           visible: true },
    { section_type: "nfc" as SectionType,            label: "NFC tap to share",  visible: false },
  ];
  return base.map((s, i) => ({
    section_type: s.section_type,
    label: s.label,
    content: {},
    display_order: i + 1,
    is_visible: s.visible,
    margin_top: 0,
    margin_bottom: 16,
    padding_top: 0,
    padding_bottom: 0,
  }));
}

async function ensureUniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const root = slugify(base);
  let candidate = root;
  for (let i = 0; i < 50; i++) {
    const { data } = await sb
      .from("business_cards")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === ignoreId) return candidate;
    candidate = `${root}-${i + 2}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function loadCardsForViewer(opts: { all: boolean; staffId: string | null }): Promise<BusinessCard[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("business_cards")
    .select(CARD_SELECT)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (!opts.all) q = q.eq("staff_user_id", opts.staffId ?? "__none__");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BusinessCard[];
}

export async function loadArchivedCards(): Promise<BusinessCard[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("business_cards")
    .select(CARD_SELECT)
    .eq("status", "archived")
    .order("archived_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BusinessCard[];
}

export async function loadCardForEdit(id: string): Promise<BusinessCard | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("business_cards")
    .select(`${CARD_SELECT}, business_card_links(*), business_card_sections(*)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as BusinessCard | null;
}

export async function loadPublicCardBySlug(slug: string): Promise<BusinessCard | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("business_cards")
    .select(`${CARD_SELECT}, business_card_links(*), business_card_sections(*)`)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as BusinessCard | null;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function computeStats(cards: BusinessCard[]): Promise<CardStats> {
  const sb = getSupabaseAdmin();
  const ids = cards.map((c) => c.id);
  let shares = 0, saves = 0, leads = 0;

  if (ids.length) {
    const { data: events } = await sb
      .from("business_card_events")
      .select("event_type")
      .in("card_id", ids)
      .in("event_type", ["share", "save_contact"]);
    for (const e of events ?? []) {
      if (e.event_type === "share") shares += 1;
      else if (e.event_type === "save_contact") saves += 1;
    }
    const { count } = await sb
      .from("business_card_leads")
      .select("id", { count: "exact", head: true })
      .in("card_id", ids);
    leads = count ?? 0;
  }

  return {
    products: cards.length,
    published: cards.filter((c) => c.status === "published").length,
    views: cards.reduce((s, c) => s + (c.view_count || 0), 0),
    clicks: cards.reduce((s, c) => s + (c.click_count || 0), 0),
    nfcReady: cards.filter((c) => c.nfc_status && c.nfc_status !== "not_ordered").length,
    shares,
    saves,
    leads,
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────────

function pickCardColumns(payload: SaveCardPayload): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of CARD_COLUMNS) {
    if (key in payload && (payload as Record<string, unknown>)[key] !== undefined) {
      row[key] = (payload as Record<string, unknown>)[key];
    }
  }
  return row;
}

export async function saveCard(
  payload: SaveCardPayload,
  ctx: { ownerStaffId: string | null; isAdmin: boolean },
): Promise<BusinessCard> {
  const sb = getSupabaseAdmin();
  const isNew = !payload.id;

  const row = pickCardColumns(payload);

  // Owner: admins may assign; everyone else owns their card.
  if (isNew) {
    row.staff_user_id = ctx.isAdmin && payload.staff_user_id ? payload.staff_user_id : ctx.ownerStaffId;
  } else if (ctx.isAdmin && payload.staff_user_id !== undefined) {
    row.staff_user_id = payload.staff_user_id;
  }

  // Publish bookkeeping
  if (payload.status === "published") {
    row.is_public = true;
    row.published_at = (payload.published_at as string) || new Date().toISOString();
  }
  if (payload.status === "archived") row.archived_at = new Date().toISOString();
  if (payload.status && payload.status !== "published") row.is_public = payload.is_public ?? false;

  // Slug
  const slugBase = payload.slug || payload.display_name || payload.card_name || "card";
  row.slug = await ensureUniqueSlug(String(slugBase), payload.id);
  row.updated_at = new Date().toISOString();

  let cardId = payload.id as string | undefined;

  if (isNew) {
    const { data, error } = await sb.from("business_cards").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    cardId = data.id as string;
    // Seed default sections for a brand-new card.
    const sections = (payload.sections?.length ? payload.sections : defaultSections()).map((s, i) => ({
      card_id: cardId,
      section_type: s.section_type,
      label: s.label,
      content: s.content ?? {},
      display_order: s.display_order ?? i + 1,
      is_visible: s.is_visible ?? true,
      margin_top: s.margin_top ?? 0,
      margin_bottom: s.margin_bottom ?? 16,
      padding_top: s.padding_top ?? 0,
      padding_bottom: s.padding_bottom ?? 0,
    }));
    if (sections.length) await sb.from("business_card_sections").insert(sections);
  } else {
    const { error } = await sb.from("business_cards").update(row).eq("id", cardId);
    if (error) throw new Error(error.message);
    if (payload.sections) await replaceSections(cardId!, payload.sections);
  }

  if (payload.links) await replaceLinks(cardId!, payload.links);

  const card = await loadCardForEdit(cardId!);
  if (!card) throw new Error("Card not found after save.");
  return card;
}

async function replaceLinks(cardId: string, links: BusinessCardLink[]) {
  const sb = getSupabaseAdmin();
  await sb.from("business_card_links").delete().eq("card_id", cardId);
  if (!links.length) return;
  const rows = links.map((l, i) => ({
    card_id: cardId,
    label: l.label || "Link",
    url: l.url || "",
    link_type: l.link_type || "custom",
    icon: l.icon ?? null,
    display_order: l.display_order ?? i + 1,
    is_visible: l.is_visible ?? true,
    open_in_new_tab: l.open_in_new_tab ?? true,
  }));
  await sb.from("business_card_links").insert(rows);
}

async function replaceSections(cardId: string, sections: BusinessCardSection[]) {
  const sb = getSupabaseAdmin();
  await sb.from("business_card_sections").delete().eq("card_id", cardId);
  if (!sections.length) return;
  const rows = sections.map((s, i) => ({
    card_id: cardId,
    section_type: s.section_type,
    label: s.label,
    content: s.content ?? {},
    display_order: s.display_order ?? i + 1,
    is_visible: s.is_visible ?? true,
    margin_top: s.margin_top ?? 0,
    margin_bottom: s.margin_bottom ?? 16,
    padding_top: s.padding_top ?? 0,
    padding_bottom: s.padding_bottom ?? 0,
  }));
  await sb.from("business_card_sections").insert(rows);
}

export async function setCardStatus(id: string, status: BusinessCard["status"]): Promise<void> {
  const sb = getSupabaseAdmin();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "published") {
    patch.is_public = true;
    patch.published_at = new Date().toISOString();
  } else if (status === "archived") {
    patch.is_public = false;
    patch.archived_at = new Date().toISOString();
  } else {
    patch.is_public = false;
  }
  const { error } = await sb.from("business_cards").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reassignCard(id: string, staffUserId: string | null): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("business_cards")
    .update({ staff_user_id: staffUserId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCard(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("business_cards").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public-side: events + leads ───────────────────────────────────────────────

export async function recordEvent(input: {
  cardId: string;
  eventType: EventType;
  linkId?: string | null;
  source?: string;
  deviceType?: string;
  referrer?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("business_card_events").insert({
    card_id: input.cardId,
    link_id: input.linkId ?? null,
    event_type: input.eventType,
    source: input.source ?? "public_card",
    device_type: input.deviceType ?? null,
    referrer: input.referrer ?? null,
    user_agent: input.userAgent ?? null,
    metadata: input.metadata ?? {},
  });
  // Maintain denormalized counters.
  if (input.eventType === "view" || input.eventType === "qr_scan" || input.eventType === "nfc_tap") {
    const { data } = await sb.from("business_cards").select("view_count").eq("id", input.cardId).maybeSingle();
    await sb.from("business_cards").update({ view_count: (data?.view_count ?? 0) + 1 }).eq("id", input.cardId);
  } else if (input.eventType === "link_click" || input.eventType === "copy_link") {
    const { data } = await sb.from("business_cards").select("click_count").eq("id", input.cardId).maybeSingle();
    await sb.from("business_cards").update({ click_count: (data?.click_count ?? 0) + 1 }).eq("id", input.cardId);
    if (input.linkId) {
      const { data: l } = await sb.from("business_card_links").select("click_count").eq("id", input.linkId).maybeSingle();
      await sb.from("business_card_links").update({ click_count: (l?.click_count ?? 0) + 1 }).eq("id", input.linkId);
    }
  }
}

export async function createLead(input: {
  cardId: string;
  ownerStaffId: string | null;
  name?: string; email?: string; phone?: string; company?: string; message?: string;
  preferredContact?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("business_card_leads").insert({
    card_id: input.cardId,
    owner_staff_id: input.ownerStaffId,
    name: input.name ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    company: input.company ?? null,
    message: input.message ?? null,
    preferred_contact: input.preferredContact ?? null,
    payload: input.payload ?? {},
  });
}

export async function loadLeads(opts: { all: boolean; staffId: string | null }): Promise<BusinessCardLead[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("business_card_leads")
    .select("*, card:business_cards(card_name, slug, display_name), owner:staff_users(display_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!opts.all) q = q.eq("owner_staff_id", opts.staffId ?? "__none__");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BusinessCardLead[];
}

export async function getLeadOwner(id: string): Promise<{ owner_staff_id: string | null } | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("business_card_leads").select("owner_staff_id").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function updateLeadStatus(id: string, status: BusinessCardLead["status"]): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("business_card_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLead(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("business_card_leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type CardAnalytics = {
  rangeDays: number;
  totals: Record<string, number>;
  views: number;
  clicks: number;
  shares: number;
  saves: number;
  leads: number;
  daily: { date: string; views: number; clicks: number }[];
  topLinks: { label: string; count: number }[];
};

export async function loadCardAnalytics(cardId: string, rangeDays = 30): Promise<CardAnalytics> {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - rangeDays * 86400000);
  const sinceIso = since.toISOString();

  const [{ data: events }, { data: links }, { count: leadCount }] = await Promise.all([
    sb.from("business_card_events").select("event_type, link_id, created_at").eq("card_id", cardId).gte("created_at", sinceIso).limit(5000),
    sb.from("business_card_links").select("id, label").eq("card_id", cardId),
    sb.from("business_card_leads").select("id", { count: "exact", head: true }).eq("card_id", cardId),
  ]);

  const totals: Record<string, number> = {};
  const linkClicks: Record<string, number> = {};
  const dayMap: Record<string, { views: number; clicks: number }> = {};

  // Seed the last `min(rangeDays,14)` days so the chart has continuous bars.
  const chartDays = Math.min(rangeDays, 14);
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dayMap[d.toISOString().slice(0, 10)] = { views: 0, clicks: 0 };
  }

  const VIEW = new Set(["view", "qr_scan", "nfc_tap"]);
  const CLICK = new Set(["link_click", "copy_link"]);

  for (const e of events ?? []) {
    totals[e.event_type] = (totals[e.event_type] ?? 0) + 1;
    if (e.link_id) linkClicks[e.link_id] = (linkClicks[e.link_id] ?? 0) + 1;
    const day = String(e.created_at).slice(0, 10);
    if (dayMap[day]) {
      if (VIEW.has(e.event_type)) dayMap[day].views += 1;
      else if (CLICK.has(e.event_type)) dayMap[day].clicks += 1;
    }
  }

  const labelById = new Map((links ?? []).map((l) => [l.id, l.label]));
  const topLinks = Object.entries(linkClicks)
    .map(([id, count]) => ({ label: labelById.get(id) || "Link", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const sum = (keys: string[]) => keys.reduce((n, k) => n + (totals[k] ?? 0), 0);

  return {
    rangeDays,
    totals,
    views: sum(["view", "qr_scan", "nfc_tap"]),
    clicks: sum(["link_click", "copy_link"]),
    shares: totals["share"] ?? 0,
    saves: totals["save_contact"] ?? 0,
    leads: leadCount ?? 0,
    daily: Object.entries(dayMap).map(([date, v]) => ({ date: date.slice(5), ...v })),
    topLinks,
  };
}

export type StaffOption = { id: string; display_name: string; email: string | null; role_slug: string | null };

export async function loadStaffOptions(): Promise<StaffOption[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("staff_users")
    .select("id, display_name, email, role_slug")
    .in("status", ["active", "invited"])
    .order("display_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffOption[];
}

export type { BusinessCard, BusinessCardLink, BusinessCardSection };
