// Project Canvas — shared types + the versioned annotation schema.
// Coordinates are stored as fractions (0–1) of the media's natural size so
// annotations survive any viewport, zoom, or device rotation.

export const CANVAS_ANNOTATIONS_VERSION = 1;

// Toolbar marker colors carry meaning into the brief.
export const CANVAS_COLORS = {
  gold: "#b08427",   // general
  red: "#c0432e",    // remove
  green: "#2e7d5b",  // add
  white: "#ffffff",  // neutral
} as const;
export type CanvasColor = (typeof CANVAS_COLORS)[keyof typeof CANVAS_COLORS];

export const COLOR_MEANING: Record<string, string> = {
  "#b08427": "general",
  "#c0432e": "marked for removal",
  "#2e7d5b": "marked as new / add",
  "#ffffff": "neutral",
};

export type Point = { x: number; y: number }; // 0–1 fractions

export type Stroke = { id: string; color: CanvasColor; points: Point[] };
export type Shape = { id: string; color: CanvasColor; points: Point[]; closed: boolean };
/**
 * Media attached to a pin so a client can show, not just describe, what they
 * want — a photo of a fixture, a shot of the wall, or a spoken note.
 */
export type PinAttachment = {
  id: string;
  kind: "image" | "audio";
  path: string;          // object path in the canvas-media bucket
  name?: string;
  transcript?: string;   // audio only, filled in after transcription
};

export type Pin = {
  id: string;
  kind: "note" | "voice";
  x: number;
  y: number;
  number?: number;
  text?: string;
  attachments?: PinAttachment[];
};
export type Stamp = { id: string; kind: string; label: string; x: number; y: number; rotation: number; scale: number };

export type SceneAnnotations = {
  v: number;
  strokes: Stroke[];
  shapes: Shape[];
  pins: Pin[];
  stamps: Stamp[];
};

export const EMPTY_ANNOTATIONS: SceneAnnotations = {
  v: CANVAS_ANNOTATIONS_VERSION, strokes: [], shapes: [], pins: [], stamps: [],
};

export type CanvasStatus = "draft" | "submitted" | "in_review" | "responded";

export type CanvasProject = {
  id: string;
  owner_contact_id: string | null;
  created_by_staff_id: string | null;
  job_id: string | null;
  project_id: string | null;
  title: string;
  status: CanvasStatus;
  bolt_summary: unknown | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  cover_path?: string | null; // first scene's flattened/media path (list views)
};

export type CanvasScene = {
  id: string;
  canvas_id: string;
  position: number;
  media_path: string | null;
  source_video_path: string | null;
  annotations: SceneAnnotations;
  flattened_path: string | null;
  created_at: string;
};

export type CanvasPin = {
  id: string;
  scene_id: string;
  client_key: string | null;
  kind: "note" | "voice";
  audio_path: string | null;
  transcript: string | null;
  transcript_status: "pending" | "done" | "failed" | null;
  created_at: string;
};

export type CanvasComment = {
  id: string;
  canvas_id: string;
  author_staff_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
};

// ── Element (stamp) library ──────────────────────────────────────────────────
// Organised by category. Placed stamps persist their own `label`, so editing
// this list never breaks stamps already saved on existing canvases.

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// These six shipped before the library was categorised. They keep their
// original `kind` so anything already saved continues to match.
const LEGACY_KINDS: Record<string, string> = {
  "Pergola": "pergola",
  "Outdoor Kitchen": "outdoor_kitchen",
  "French Doors": "french_doors",
  "Fire Pit": "fire_pit",
  "Retaining Wall": "retaining_wall",
  "Planter Bed": "planter_bed",
};

export type StampItem = { kind: string; label: string; category: string };
export type StampCategory = { key: string; label: string; items: StampItem[] };

const CATEGORY_SOURCE: { key: string; label: string; labels: string[] }[] = [
  {
    key: "wall",
    label: "Wall Finishes",
    labels: [
      "Interior Paint", "Exterior Paint", "Accent Wall", "Wallpaper", "Wall Mural",
      "Roman Clay", "Limewash", "Venetian Plaster", "Textured Plaster", "Wall Wrap",
      "Vinyl Wall Graphic", "Wood Slat Wall", "Wood Paneling", "Shiplap",
      "Board and Batten", "Wainscoting", "Decorative Molding", "Stone Veneer",
      "Brick Veneer", "Tile Wall", "Concrete Finish", "Microcement",
      "Acoustic Wall Panels", "Fabric Wall Panels", "Cork Wall", "Living Plant Wall",
    ],
  },
  {
    key: "outdoor",
    label: "Outdoor Living",
    labels: [
      "Covered Patio", "Ramada", "Gazebo", "Pavilion", "Pergola", "Deck", "Balcony",
      "Rooftop Terrace", "Screened Patio", "Outdoor Fireplace", "Fire Pit",
      "Pizza Oven", "BBQ Island", "Outdoor Kitchen", "Outdoor Bar",
      "Built-In Seating", "Shade Sail",
    ],
  },
  {
    key: "landscape",
    label: "Landscaping",
    labels: [
      "Artificial Turf", "Grass Lawn", "Raised Garden Bed", "Planter Bed",
      "Desert Landscaping", "Trees", "Privacy Hedge", "Decorative Rock",
      "Water Feature", "Garden Path", "Landscape Lighting", "Irrigation System",
      "Drainage System",
    ],
  },
  {
    key: "hardscape",
    label: "Hardscape",
    labels: [
      "Paver Patio", "Concrete Patio", "Walkway", "Driveway", "Courtyard",
      "Garden Wall", "Seat Wall", "Retaining Wall", "Stone Veneer", "Outdoor Steps",
      "Pool Deck",
    ],
  },
  {
    key: "openings",
    label: "Doors, Windows, and Openings",
    labels: [
      "Sliding Glass Doors", "Bi-Fold Doors", "Accordion Doors", "French Doors",
      "Barn Doors", "Garage Doors", "Entry Doors", "Picture Windows",
      "Clerestory Windows", "Skylights",
    ],
  },
  {
    key: "structures",
    label: "Structures and Additions",
    labels: [
      "Casita", "ADU", "Guest House", "Pool House", "Workshop", "Detached Garage",
      "Carport", "Storage Shed", "Home Addition", "Sunroom", "Arizona Room",
    ],
  },
  {
    key: "pool",
    label: "Pool and Recreation",
    labels: [
      "Swimming Pool", "Spa or Hot Tub", "Baja Shelf", "Pool Waterfall",
      "Outdoor Shower", "Putting Green", "Sport Court", "Play Area", "Dog Run",
    ],
  },
  {
    key: "property",
    label: "Property and Utility Features",
    labels: [
      "Block Wall", "Privacy Fence", "Decorative Fence", "Entry Gate", "RV Gate",
      "Trash Enclosure", "Equipment Screen", "Solar Panels", "EV Charger",
      "Generator", "Exterior Lighting", "Security Cameras",
    ],
  },
];

export const STAMP_CATEGORIES: StampCategory[] = CATEGORY_SOURCE.map((c) => ({
  key: c.key,
  label: c.label,
  items: c.labels.map((label) => ({
    // Category-prefixed so labels that appear in two categories (e.g. "Stone
    // Veneer" under both Wall Finishes and Hardscape) stay distinct.
    kind: LEGACY_KINDS[label] ?? `${c.key}_${slug(label)}`,
    label,
    category: c.label,
  })),
}));

/** Flat list of every element, for lookup and for the brief serializer. */
export const STAMP_LIBRARY: StampItem[] = STAMP_CATEGORIES.flatMap((c) => c.items);

export const CANVAS_MEDIA_BUCKET = "canvas-media";
// Gates the dashboard + client-portal Project Canvas feature.
export const FEATURE_PROJECT_CANVAS = "project_canvas";
// Separately gates the PUBLIC/marketing surfaces (site nav, footer, and the
// /project-canvas landing page). Kept off until the feature is ready to go
// live on the frontend, while FEATURE_PROJECT_CANVAS stays on for staff/clients.
export const FEATURE_PROJECT_CANVAS_PUBLIC = "project_canvas_public";
