import type { Config } from "tailwindcss";

// Colours are CSS variables (light/dark in app/globals.css). Wrapping them in
// color-mix with <alpha-value> lets opacity modifiers work: bg-muted/40,
// border-border/60, bg-accent/15. Without it Tailwind drops those classes.
const withAlpha = (v: string) => `color-mix(in oklch, var(${v}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: withAlpha("--background"),
        foreground: withAlpha("--foreground"),
        card: withAlpha("--card"),
        "card-foreground": withAlpha("--card-foreground"),
        popover: withAlpha("--popover"),
        "popover-foreground": withAlpha("--popover-foreground"),
        muted: withAlpha("--muted"),
        "muted-foreground": withAlpha("--muted-foreground"),
        border: withAlpha("--border"),
        input: withAlpha("--input"),
        ring: withAlpha("--ring"),
        primary: withAlpha("--primary"),
        "primary-foreground": withAlpha("--primary-foreground"),
        secondary: withAlpha("--secondary"),
        "secondary-foreground": withAlpha("--secondary-foreground"),
        accent: withAlpha("--accent"),
        "accent-foreground": withAlpha("--accent-foreground"),
        destructive: withAlpha("--destructive"),
        "destructive-foreground": withAlpha("--destructive-foreground"),
        success: withAlpha("--success"),
        warning: withAlpha("--warning"),
        info: withAlpha("--info")
      },
      // Opacity steps used across the app that Tailwind 3 doesn't ship (bg-accent/12,
      // bg-black/35…); without them those classes were silently dropped, e.g. the
      // active sidebar item had no background.
      opacity: { 3: "0.03", 6: "0.06", 7: "0.07", 8: "0.08", 12: "0.12", 14: "0.14", 18: "0.18", 35: "0.35", 45: "0.45", 55: "0.55", 65: "0.65", 85: "0.85" },
      // Plain "border" (no colour class) uses the design token, not Tailwind's grey.
      borderColor: { DEFAULT: "var(--border)" },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        display: ["var(--font-display)"]
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)"
      },
      keyframes: {
        "tooltip-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        // Schedule: a soft light sweeping across the next task due.
        "next-sweep": { "0%": { transform: "translateX(-100%)", opacity: "0" }, "20%": { opacity: "1" }, "80%": { opacity: "1" }, "100%": { transform: "translateX(100%)", opacity: "0" } },
        "next-glow": { "0%, 100%": { boxShadow: "0 0 0 0 color-mix(in oklch, var(--accent) 45%, transparent)" }, "50%": { boxShadow: "0 0 0 4px color-mix(in oklch, var(--accent) 0%, transparent)" } }
      },
      animation: {
        "tooltip-in": "tooltip-in 120ms ease-out",
        "next-sweep": "next-sweep 2.4s ease-in-out infinite",
        "next-glow": "next-glow 2.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
