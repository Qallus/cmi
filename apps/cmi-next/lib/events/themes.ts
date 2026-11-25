// Event invitation themes. Pure data (no React, no path aliases) so tests and
// the HTML export can import it directly.
//
// Each theme sets the hero palette and its animation. The animation itself is
// drawn by components/events/hero-animation.tsx (and the same script is inlined
// into exported pages); here we only name it.

export type HeroAnimation = "snow" | "confetti" | "fireworks" | "blueprint" | "bokeh" | "none";

export type EventTheme = {
  id: string;
  name: string;
  description: string;
  animation: HeroAnimation;
  /** Hero background (CSS). */
  heroBg: string;
  /** Hero text colour. */
  heroInk: string;
  /** Eyebrow / small-label colour on the hero. */
  heroMuted: string;
  /** Accent: the highlighted title word, the RSVP button, section dots. */
  accent: string;
  /** Three-colour stripe under the hero. */
  stripe: [string, string, string];
  /** Primary choice button (e.g. "I'll be there") when selected. */
  choice: string;
  /** Faint pattern glyph colour over the hero. */
  pattern: string;
};

export const EVENT_THEMES: EventTheme[] = [
  {
    id: "snowfall",
    name: "Snowfall",
    description: "Holiday dark hero with falling snow. Matches the 2026 Christmas invite.",
    animation: "snow",
    heroBg: "linear-gradient(120deg, #1b1b1b 0%, #232120 55%, #3a3127 100%)",
    heroInk: "#ffffff",
    heroMuted: "#b89a74",
    accent: "#e0392b",
    stripe: ["#e0392b", "#b89a74", "#2f5a45"],
    choice: "#4a3b2a",
    pattern: "rgba(255,255,255,0.07)",
  },
  {
    id: "confetti",
    name: "Confetti",
    description: "Celebrations, milestones and project completions.",
    animation: "confetti",
    heroBg: "linear-gradient(120deg, #141414 0%, #1f1f22 60%, #2b2620 100%)",
    heroInk: "#ffffff",
    heroMuted: "#c9a46e",
    accent: "#c9a46e",
    stripe: ["#c9a46e", "#9e6f2e", "#e7e5e4"],
    choice: "#3f3426",
    pattern: "rgba(255,255,255,0.05)",
  },
  {
    id: "fireworks",
    name: "Fireworks",
    description: "New Year's and evening celebrations.",
    animation: "fireworks",
    heroBg: "linear-gradient(180deg, #0b0d17 0%, #141a2e 70%, #20263f 100%)",
    heroInk: "#ffffff",
    heroMuted: "#d4b072",
    accent: "#d4b072",
    stripe: ["#d4b072", "#8a93b8", "#3a4470"],
    choice: "#2b3150",
    pattern: "rgba(255,255,255,0.05)",
  },
  {
    id: "blueprint",
    name: "Blueprint",
    description: "A drifting CMI drawing grid. Groundbreakings, open houses, trade events.",
    animation: "blueprint",
    heroBg: "linear-gradient(135deg, #0f2233 0%, #15304a 60%, #1c3d5c 100%)",
    heroInk: "#ffffff",
    heroMuted: "#a9c3da",
    accent: "#c9a46e",
    stripe: ["#c9a46e", "#5d86a8", "#e7e5e4"],
    choice: "#1c3d5c",
    pattern: "rgba(169,195,218,0.12)",
  },
  {
    id: "bokeh",
    name: "Golden bokeh",
    description: "Soft drifting lights. Client appreciation and dinners.",
    animation: "bokeh",
    heroBg: "linear-gradient(120deg, #17130f 0%, #251d15 60%, #3b2c1c 100%)",
    heroInk: "#ffffff",
    heroMuted: "#d8b98a",
    accent: "#d8a85c",
    stripe: ["#d8a85c", "#9e6f2e", "#5b4630"],
    choice: "#4a3b2a",
    pattern: "rgba(255,255,255,0.05)",
  },
  {
    id: "classic",
    name: "Classic (no animation)",
    description: "The CMI brand on a still dark hero.",
    animation: "none",
    heroBg: "#111111",
    heroInk: "#ffffff",
    heroMuted: "#c9a46e",
    accent: "#9e6f2e",
    stripe: ["#9e6f2e", "#c9a46e", "#e7e5e4"],
    choice: "#111111",
    pattern: "rgba(255,255,255,0.04)",
  },
];

export const DEFAULT_THEME_ID = "snowfall";

export function themeById(id: string | null | undefined): EventTheme {
  return EVENT_THEMES.find((t) => t.id === id) ?? EVENT_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}

export function isThemeId(id: unknown): id is string {
  return typeof id === "string" && EVENT_THEMES.some((t) => t.id === id);
}
