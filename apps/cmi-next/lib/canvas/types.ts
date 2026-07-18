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
export type Pin = { id: string; kind: "note" | "voice"; x: number; y: number; number?: number; text?: string };
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
  created_at: string;
  updated_at: string;
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

// v1 stamp library (stored as a config array so CMI can extend it later).
export const STAMP_LIBRARY = [
  { kind: "pergola", label: "Pergola" },
  { kind: "outdoor_kitchen", label: "Outdoor Kitchen" },
  { kind: "french_doors", label: "French Doors" },
  { kind: "fire_pit", label: "Fire Pit" },
  { kind: "retaining_wall", label: "Retaining Wall" },
  { kind: "planter_bed", label: "Planter Bed" },
] as const;

export const CANVAS_MEDIA_BUCKET = "canvas-media";
export const FEATURE_PROJECT_CANVAS = "project_canvas";
