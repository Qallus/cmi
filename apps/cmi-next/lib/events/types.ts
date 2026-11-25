import type { EventDesign } from "./design.ts";

export type EventStatus = "draft" | "published" | "private" | "archived" | "canceled";
export type EventAccess = "invite_only" | "link";

/** An invitation-kind row of booking_event_pages, with the design parsed. */
export type InvitationEvent = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  /** Venue and address, one per line. */
  location: string | null;
  status: EventStatus;
  access: EventAccess;
  design_mode: "theme" | "custom";
  design: EventDesign;
  custom_html: string | null;
  rsvp_deadline: string | null;
  allow_plus_one: boolean;
  host_staff_user_id: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type EventRsvp = {
  id: string;
  event_page_id: string;
  token: string;
  staff_user_id: string | null;
  contact_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  source: "invite" | "link" | "manual";
  invited_by: string | null;
  sent_at: string | null;
  sent_channel: string | null;
  opened_at: string | null;
  status: "invited" | "attending" | "declined";
  plus_one: boolean;
  plus_one_name: string | null;
  notes: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

/** What a guest's own browser may see about their RSVP. */
export type PublicRsvp = Pick<EventRsvp, "token" | "name" | "email" | "status" | "plus_one" | "plus_one_name" | "notes">;

export type PublicGuests = { count: number; names: { name: string; plus_one: boolean }[] };

export type EventSummary = InvitationEvent & {
  counts: { attending: number; declined: number; waiting: number; plusOnes: number; headcount: number; invited: number };
};
