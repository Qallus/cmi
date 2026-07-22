import type { ReactNode } from "react";

export type Service = {
  key: string;
  title: string;
  /** Short line used by the animated hero. */
  tagline: string;
  /** Longer card copy used by the services grid. */
  body: string;
  points: string[];
  /**
   * Kept but currently unrendered: the individual service pages are still live,
   * but nothing on the site links to them until their content is reviewed.
   */
  href: string;
  linkLabel: string;
  /**
   * Icon geometry only — the wrapping <svg> is supplied by the consumer so the
   * same paths can render at hero scale or card scale. Every element carries
   * pathLength="1" so the draw-on animation in globals.css is exact.
   */
  icon: ReactNode;
};

export const SERVICES: Service[] = [
  {
    key: "residential",
    title: "Custom Homes and Casitas",
    tagline: "Homes and guest houses designed around how you actually live.",
    body: "Custom homes, guest houses, and casitas designed around your lifestyle and built with enduring materials.",
    points: ["Custom floor plans", "Premium material sourcing", "Dedicated project manager"],
    href: "/services/residential",
    linkLabel: "Explore custom homes",
    icon: (
      <>
        <path pathLength="1" d="M3 11.6 12 4l9 7.6" />
        <path pathLength="1" d="M5.4 10.2V20h13.2v-9.8" />
        <path pathLength="1" d="M10 20v-5.3h4V20" />
      </>
    ),
  },
  {
    key: "commercial",
    title: "Boutique Commercial",
    tagline: "Retail, office, and tenant improvements built to your brand.",
    body: "Functional, modern commercial spaces that elevate your brand and support the way your team works.",
    points: ["Tenant improvements", "MEP coordination", "Phased occupied builds"],
    href: "/services/commercial",
    linkLabel: "Explore commercial",
    icon: (
      <>
        <path pathLength="1" d="M4 21V6.4L13 3.2V21" />
        <path pathLength="1" d="M13 10.4h7V21" />
        <path pathLength="1" d="M7.4 9.2h2.4M7.4 13h2.4M7.4 16.8h2.4M16 14.2h1.6" />
        <path pathLength="1" d="M2.4 21h19.2" />
      </>
    ),
  },
  {
    key: "adu",
    title: "ADU",
    tagline: "Accessory dwelling units that unlock value from your lot.",
    body: "Accessory dwelling units that maximize your property's potential with turnkey permitting and design.",
    points: ["Feasibility and zoning review", "Permitting handled end to end", "Turnkey design and build"],
    href: "/services/adu",
    linkLabel: "Explore ADUs",
    icon: (
      <>
        <path pathLength="1" d="M3 12.6 9 7.4l6 5.2" />
        <path pathLength="1" d="M4.7 11.4V20h8.6v-8.6" />
        <path pathLength="1" d="M14.6 20v-6.3h5.6V20" />
        <path pathLength="1" d="M2.4 20h19.2" />
      </>
    ),
  },
  {
    key: "renovations-additions",
    title: "Renovations and Additions",
    tagline: "Expansions planned around the structure and your daily life.",
    body: "Thoughtful updates, expansions, and additions planned around the structure, schedule, and daily life of the space.",
    points: ["Structural assessment", "Live-in phasing", "Permit to punch list"],
    href: "/services/renovations-additions",
    linkLabel: "Explore renovations",
    icon: (
      <>
        <path pathLength="1" d="M3.4 11.9 11 5.6l7.6 6.3" />
        <path pathLength="1" d="M5.2 10.6v8.9h11.6v-8.9" />
        <path pathLength="1" d="M17.6 3.4v5.8M14.7 6.3h5.8" />
        <path pathLength="1" d="M2.4 19.5h19.2" />
      </>
    ),
  },
  {
    key: "architectural-design",
    title: "Architectural and Design Coordination",
    tagline: "Design intent held steady from first sketch to final finish.",
    body: "Coordinated plans, selections, and construction details that keep the design intent aligned from concept through build.",
    points: ["Spatial planning", "Material and finish selections", "Architect and trade coordination"],
    href: "/services/architectural-design",
    linkLabel: "Explore design coordination",
    icon: (
      <>
        <circle pathLength="1" cx="12" cy="4.8" r="1.9" />
        <path pathLength="1" d="M10.8 6.5 6 19.6" />
        <path pathLength="1" d="M13.2 6.5 18 19.6" />
        <path pathLength="1" d="M7.7 15.4a9.4 9.4 0 0 0 8.6 0" />
      </>
    ),
  },
  {
    key: "new-construction",
    title: "New Construction",
    tagline: "Ground-up builds handled through every phase, start to finish.",
    body: "Ground-up builds from foundation to finish, handled through every phase with uncompromising standards.",
    points: ["Site work and foundations", "Single and multi-family", "Milestone-driven scheduling"],
    href: "/services/new-construction",
    linkLabel: "Explore new construction",
    icon: (
      <>
        <path pathLength="1" d="M7 20.6V4.4" />
        <path pathLength="1" d="M3.2 8h15.6" />
        <path pathLength="1" d="M7 4.4 12.2 8" />
        <path pathLength="1" d="M15.6 8v3.8M13.7 11.8h3.8v3.4h-3.8z" />
        <path pathLength="1" d="M4 20.6h6" />
      </>
    ),
  },
  {
    key: "pools-landscaping",
    title: "Pools and Landscaping",
    tagline: "Pools, hardscape, and desert planting as one outdoor room.",
    body: "Pools, spas, hardscape, and desert landscaping designed as one continuous extension of the home and how you use it.",
    points: ["Pools, spas, and water features", "Hardscape, decking, and shade", "Low-water desert planting"],
    href: "/services",
    linkLabel: "Explore outdoor living",
    icon: (
      <>
        <path pathLength="1" d="M2.6 15.4c1.8 0 1.8 1.4 3.6 1.4s1.8-1.4 3.6-1.4 1.8 1.4 3.6 1.4 1.8-1.4 3.6-1.4 1.8 1.4 3.4 1.4" />
        <path pathLength="1" d="M2.6 19.4c1.8 0 1.8 1.4 3.6 1.4s1.8-1.4 3.6-1.4 1.8 1.4 3.6 1.4 1.8-1.4 3.6-1.4 1.8 1.4 3.4 1.4" />
        <path pathLength="1" d="M12 12.8V6.6" />
        <path pathLength="1" d="M12 9.2C10 9.2 8.5 7.7 8.5 5.8c1.9 0 3.5 1.5 3.5 3.4Z" />
        <path pathLength="1" d="M12 8.2c0-1.9 1.5-3.4 3.5-3.4 0 1.9-1.5 3.4-3.5 3.4Z" />
      </>
    ),
  },
];

/** Shared <svg> wrapper so hero and cards render identical geometry. */
export function ServiceIcon({
  service,
  className,
  strokeWidth = 1.5,
  draw = false,
}: {
  service: Service;
  className?: string;
  strokeWidth?: number;
  draw?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={[draw ? "cmi-draw-icon" : "", className ?? ""].filter(Boolean).join(" ")}
    >
      {service.icon}
    </svg>
  );
}
