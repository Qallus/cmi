import type { ReactNode } from "react";

// Two-column auth shell: form on the left, a branded panel on the right (desktop
// only). The right panel uses the company's own mission/positioning — not a
// fabricated customer testimonial.
type Stat = { value: string; label: string };
type Panel = {
  eyebrow: string;
  quote: string;
  attribution: string;
  attributionSub?: string;
  stats: Stat[];
  image: string;
};

const PANEL_IMAGE =
  "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/589cd039-0f3e-488c-a28a-dc00086c6c8a/Conrad+Residence-13.jpg";

const PANELS: Record<"staff" | "client", Panel> = {
  staff: {
    eyebrow: "Constructed Matter, Inc.",
    quote:
      "Craftsmanship, communication, and relationships that last well beyond the final walkthrough.",
    attribution: "A turnkey construction firm driven by design",
    attributionSub: "Scottsdale · Greater Phoenix, Arizona",
    stats: [
      { value: "Est. 2014", label: "Building in Arizona" },
      { value: "Design-Build", label: "One accountable team" },
      { value: "ROC KB1-343120", label: "Licensed & bonded" },
    ],
    image: PANEL_IMAGE,
  },
  client: {
    eyebrow: "Your Project Portal",
    quote:
      "Your plans, selections, documents, and updates — all in one place, from first sketch to final walkthrough.",
    attribution: "Constructed Matter, Inc.",
    attributionSub: "Scottsdale · Greater Phoenix, Arizona",
    stats: [
      { value: "One Place", label: "Everything about your build" },
      { value: "Real-Time", label: "Updates as work happens" },
      { value: "Direct", label: "Message your project team" },
    ],
    image: PANEL_IMAGE,
  },
};

export function AuthLayout({
  children,
  variant = "staff",
}: {
  children: ReactNode;
  variant?: "staff" | "client";
}) {
  const panel = PANELS[variant];
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col justify-center bg-background px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/cmi-favicon-black.png" alt="Constructed Matter, Inc." className="h-11 w-11 object-contain dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/cmi-favicon-white.png" alt="Constructed Matter, Inc." className="hidden h-11 w-11 object-contain dark:block" />
          </div>
          {children}
        </div>
      </div>

      {/* Right — branded panel (desktop only) */}
      <div className="relative hidden overflow-hidden bg-black lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={panel.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/85 to-black/45" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white xl:p-16">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {panel.eyebrow}
          </div>
          <div className="max-w-lg">
            <p className="font-display text-3xl font-semibold leading-snug xl:text-4xl">
              &ldquo;{panel.quote}&rdquo;
            </p>
            <div className="mt-7">
              <div className="text-sm font-semibold">{panel.attribution}</div>
              {panel.attributionSub && <div className="mt-0.5 text-sm text-white/55">{panel.attributionSub}</div>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {panel.stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-lg font-semibold xl:text-xl">{s.value}</div>
                <div className="mt-1 text-[11px] leading-tight text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
