// Turn Bolt's JSON reply into a safe event draft. Pure (no I/O, no aliases), so
// it's unit-tested; lib/events/draft.ts does the model call.
import { normalizeDesign, type EventDesign } from "./design.ts";
import { azLocalToIso } from "./format.ts";

export type EventDraft = {
  title: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  rsvp_deadline: string | null;
  allow_plus_one: boolean;
  access: "invite_only" | "link";
  summary: string;
  design: EventDesign;
};

const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function draftFromModel(raw: Record<string, unknown>, existing?: Partial<EventDesign>): EventDraft {
  return {
    title: txt(raw.title, 160),
    start_time: azLocalToIso(raw.start),
    end_time: azLocalToIso(raw.end),
    location: txt(raw.location, 400),
    rsvp_deadline: azLocalToIso(raw.rsvp_by),
    allow_plus_one: raw.allow_plus_one !== false,
    access: raw.open_link === true ? "link" : "invite_only",
    summary: txt(raw.summary, 400),
    design: normalizeDesign(raw.design, existing),
  };
}
