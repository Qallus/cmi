import { ServicePageLayout } from "@/components/site/service-page-layout";

export const metadata = { title: "Renovations & Additions — Constructed Matter" };

const OTHER = [
  { title: "Residential", subtitle: "Custom homes", href: "/services/residential" },
  { title: "Commercial", subtitle: "Office & retail spaces", href: "/services/commercial" },
  { title: "ADU", subtitle: "Accessory dwelling units", href: "/services/adu" },
  { title: "Architectural & Design", subtitle: "Spaces that reflect you", href: "/services/architectural-design" },
  { title: "New Construction", subtitle: "Ground-up builds", href: "/services/new-construction" },
];

export default function RenovationsAdditionsPage() {
  return (
    <ServicePageLayout
      category="Renovations & Additions"
      headline={"Transform Your<br/>Existing Space"}
      subheadline="Thoughtful updates, expansions, and additions planned around the structure, schedule, and daily life of your space."
      heroImage="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/ca1f785c-2a89-43ad-a9a9-43e5d964e576/VW+Garage-4.jpg?format=1500w"
      stats={[
        { value: "80+", label: "Renovations Completed" },
        { value: "6 mo", label: "Avg. Timeline" },
        { value: "98%", label: "Client Satisfaction" },
      ]}
      description={[
        "Renovation Done<br/>Right, The First Time",
        "Renovations are inherently more complex than new construction — you're working within existing constraints, around the people who live or work in the space, and often uncovering surprises along the way. Our team is trained to anticipate and manage these challenges so your project stays on track.",
        "Whether you're updating a kitchen, adding a second story, or converting a garage into living space, we bring the same level of planning, communication, and craftsmanship as our new construction projects — with extra care for your existing home.",
      ]}
      features={[
        { title: "Pre-Construction Planning", body: "Detailed scope review before breaking ground to prevent costly surprises.", icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6m-3 7h3m-6 4h6" /> },
        { title: "Permit Management", body: "We handle all city permits, inspections, and code compliance.", icon: <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { title: "Occupied Renovations", body: "Phased work plans that keep your family or business operational.", icon: <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /> },
        { title: "Structural Additions", body: "Room additions and second stories engineered for your existing foundation.", icon: <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /> },
        { title: "Finish Matching", body: "Expert sourcing to match existing materials and blend old with new.", icon: <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /> },
        { title: "Budget Transparency", body: "Line-item estimates with change order controls so you stay in budget.", icon: <path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /> },
      ]}
      ctaHeadline="Let's Plan Your Renovation"
      ctaBody="Get a free consultation with our renovation team and we'll walk through your goals, timeline, and budget."
      ctaBg="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/ca1f785c-2a89-43ad-a9a9-43e5d964e576/VW+Garage-4.jpg?format=1500w"
      otherServices={OTHER}
    />
  );
}
