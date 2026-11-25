// Shared by the Claude connector (lib/mcp/tools-events.ts) and Bolt
// (lib/agent/event-tools.ts): turn friendly tool arguments into the
// EventInput the data layer validates.
import { azLocalToIso } from "./format";
import type { EventInput } from "./data";

type Args = Record<string, unknown>;

/** Tool args (start/end in Arizona time, rsvp_by as a date, open_link) → EventInput. Only keys given are set. */
export function eventInputFromArgs(a: Args): EventInput {
  const out: EventInput = {};
  const has = (k: string) => a[k] !== undefined && a[k] !== null;
  if (has("title")) out.title = a.title;
  if (has("start")) {
    const iso = azLocalToIso(a.start);
    if (!iso) throw new Error(`Couldn't read the start "${String(a.start)}". Use YYYY-MM-DDTHH:MM in Arizona time.`);
    out.start_time = iso;
  }
  if (has("end")) {
    const iso = azLocalToIso(a.end);
    if (!iso) throw new Error(`Couldn't read the end "${String(a.end)}". Use YYYY-MM-DDTHH:MM in Arizona time.`);
    out.end_time = iso;
  }
  if (has("location")) out.location = a.location;
  if (has("rsvp_by")) out.rsvp_deadline = a.rsvp_by === "" ? null : azLocalToIso(a.rsvp_by);
  if (has("allow_plus_one")) out.allow_plus_one = a.allow_plus_one;
  if (has("open_link")) out.access = a.open_link ? "link" : "invite_only";
  if (has("summary")) out.summary = a.summary;
  if (has("design")) out.design = a.design;
  if (has("custom_html")) {
    out.custom_html = a.custom_html;
    // Giving HTML means "use it", unless they also said which mode.
    if (!has("design_mode")) out.design_mode = typeof a.custom_html === "string" && a.custom_html.trim() ? "custom" : "theme";
  }
  if (has("design_mode")) out.design_mode = a.design_mode;
  return out;
}

/** JSON schema for the design object, for tool definitions. */
export const DESIGN_SCHEMA = {
  type: "object",
  description: "Page design. Only include what you're setting; the rest is kept.",
  properties: {
    theme: { type: "string", description: "snowfall | confetti | fireworks | blueprint | bokeh | classic (see the themes tool)" },
    eyebrow: { type: "string", description: "Small line over the title, e.g. \"Constructed Matter · You're invited\"" },
    title_accent: { type: "string", description: "Words from the title shown in the accent colour, e.g. \"2026\"" },
    message_heading: { type: "string" },
    message_body: { type: "string" },
    signoff: { type: "string", description: "Use \\n between lines, e.g. \"Merry Christmas,\\nBrandon & Joe\"" },
    rsvp_note: { type: "string", description: "Optional note above the RSVP buttons (another way to RSVP)" },
    good_to_know: {
      type: "array",
      items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" }, url: { type: "string" } }, required: ["label", "value"] },
    },
    guest_list: { type: "string", enum: ["full", "first", "count", "off"], description: "How the Who's coming list shows names" },
    dietary: { type: "boolean", description: "Ask for dietary needs or notes" },
    footer_note: { type: "string" },
    image_url: { type: "string", description: "Optional https photo URL" },
  },
} as const;

export const EVENT_FIELDS_SCHEMA = {
  title: { type: "string", description: "Event title" },
  start: { type: "string", description: "Start, YYYY-MM-DDTHH:MM in Arizona time" },
  end: { type: "string", description: "End, YYYY-MM-DDTHH:MM in Arizona time (default: 3 hours after start)" },
  location: { type: "string", description: "Venue on the first line, street address on the second (use \\n)" },
  rsvp_by: { type: "string", description: "RSVP deadline date, YYYY-MM-DD" },
  allow_plus_one: { type: "boolean" },
  open_link: { type: "boolean", description: "true: anyone with the link can RSVP. false (default): invited guests only, each with a personal link" },
  summary: { type: "string", description: "One sentence for link previews" },
  design: DESIGN_SCHEMA,
  custom_html: {
    type: "string",
    description: "Optional full custom page design in HTML (hero, message, CSS/JS animation), up to 500 KB. It's shown in a sandboxed frame above CMI's own RSVP card, Good to know and Who's coming, so don't include an RSVP form. Setting it switches the page to the custom design.",
  },
  design_mode: { type: "string", enum: ["theme", "custom"], description: "theme (built-in animated themes) or custom (the custom_html)" },
} as const;
