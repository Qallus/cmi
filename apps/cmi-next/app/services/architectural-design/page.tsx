import { ServicePageLayout } from "@/components/site/service-page-layout";

export const metadata = { title: "Architectural & Design Coordination — Constructed Matter" };

const OTHER = [
  { title: "Residential", subtitle: "Custom homes", href: "/services/residential" },
  { title: "Commercial", subtitle: "Office & retail spaces", href: "/services/commercial" },
  { title: "ADU", subtitle: "Accessory dwelling units", href: "/services/adu" },
  { title: "Renovations & Additions", subtitle: "Updates & expansions", href: "/services/renovations-additions" },
  { title: "New Construction", subtitle: "Ground-up builds", href: "/services/new-construction" },
];

export default function ArchitecturalDesignPage() {
  return (
    <ServicePageLayout
      category="Architectural & Design Coordination"
      headline={"Design That<br/>Tells Your Story"}
      subheadline="Coordinated plans, selections, and construction details that keep the design intent aligned from concept through build."
      heroImage="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/7fac9d01-d6fb-4bd6-bcdf-aa1feb69aa7f/Schott+Residence-2.jpg?format=1500w"
      stats={[
        { value: "60+", label: "Design Projects" },
        { value: "100%", label: "Design-Build Capable" },
        { value: "5★", label: "Avg. Client Rating" },
      ]}
      description={[
        "Where Vision<br/>Becomes Reality",
        "Great design isn't just about how a space looks — it's about how it feels to live or work in it. Our architectural and design coordination team bridges the gap between your vision and the construction team, ensuring every material selection, spatial decision, and detail is aligned from start to finish.",
        "We work alongside your architect or manage the full coordination ourselves, depending on where you are in the process. From concept mood boards through finish selections and construction documentation, we keep the design intent protected throughout every phase of the build.",
      ]}
      features={[
        { title: "Material Selections", body: "Curated flooring, tile, cabinet, fixture, and hardware palettes.", icon: <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /> },
        { title: "Space Planning", body: "Furniture layouts and spatial flow optimized for how you use the space.", icon: <path d="M4 20h16M4 20V10l4-6h8l4 6v10M9 20v-4a3 3 0 016 0v4" /> },
        { title: "Lighting Design", body: "Layered lighting plans that set the mood and functionality of each room.", icon: <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> },
        { title: "Architect Coordination", body: "We work with your architect to translate drawings into buildable details.", icon: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
        { title: "Custom Millwork", body: "Built-ins, cabinetry, and shelving designed for your exact space.", icon: <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /> },
        { title: "Site Procurement", body: "We source and manage delivery of all specified materials on schedule.", icon: <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      ]}
      ctaHeadline="Let's Talk About Your Design"
      ctaBody="Start with a consultation where we explore your style, goals, and how to bring the vision to life."
      ctaBg="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/a5134c71-2845-460c-98cc-a897b612b5d5/Conrad+Residence-13.jpg"
      otherServices={OTHER}
    />
  );
}
