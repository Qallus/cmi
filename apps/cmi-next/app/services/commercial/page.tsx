import { ServicePageLayout } from "@/components/site/service-page-layout";

export const metadata = { title: "Commercial Construction — Constructed Matter" };

const OTHER = [
  { title: "Residential", subtitle: "Custom homes", href: "/services/residential" },
  { title: "ADU", subtitle: "Accessory dwelling units", href: "/services/adu" },
  { title: "Renovations & Additions", subtitle: "Updates & expansions", href: "/services/renovations-additions" },
  { title: "Architectural & Design", subtitle: "Spaces that reflect you", href: "/services/architectural-design" },
  { title: "New Construction", subtitle: "Ground-up builds", href: "/services/new-construction" },
];

export default function CommercialPage() {
  return (
    <ServicePageLayout
      category="Commercial"
      headline={"Boutique Commercial<br/>Spaces That Work"}
      subheadline="Functional, modern commercial spaces that elevate your brand and support the way your team works."
      heroImage="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1712241900212-YJ82KS4IKVY52B3LLIZJ/Hotel-2.jpg?format=1500w"
      stats={[
        { value: "50+", label: "Commercial Projects" },
        { value: "12K+", label: "Avg. Sq Ft" },
        { value: "On Time", label: "Delivery Rate" },
      ]}
      description={[
        "Your Brand,<br/>Our Build",
        "Commercial construction requires a different kind of discipline — tight timelines, occupied neighboring spaces, and a direct impact on your bottom line. Constructed Matter brings the same level of care and craftsmanship from our residential work to every commercial build-out, tenant improvement, and ground-up commercial project.",
        "We specialize in boutique commercial projects across the Greater Phoenix Metro Area, from office suites and retail spaces to restaurant build-outs and professional service offices. Our team handles everything from permits and MEP coordination through final finishes.",
      ]}
      features={[
        { title: "Tenant Improvements", body: "Full TI coordination from permit to punch list for occupied buildings.", icon: <path d="M3 21h18M3 7v14m6-14v14m6-14v14m6-14v14M3 7l9-4 9 4" /> },
        { title: "MEP Coordination", body: "Mechanical, electrical, and plumbing managed in-house.", icon: <path d="M13 10V3L4 14h7v7l9-11h-7z" /> },
        { title: "Brand-Aligned Finishes", body: "Material and finish selections that match your brand standards.", icon: <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /> },
        { title: "ADA Compliance", body: "All projects designed and built to current ADA standards.", icon: <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { title: "Fast-Track Schedules", body: "Phased build plans that minimize business disruption.", icon: <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /> },
        { title: "Cost Control", body: "Detailed estimates and value-engineering to protect your budget.", icon: <path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /> },
      ]}
      ctaHeadline="Let's Build Your Commercial Space"
      ctaBody="Contact our commercial team for a free consultation and project estimate."
      ctaBg="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1712244593060-S7HC61T66LQH3IRBMVR9/Trinity+Church-14.jpg?format=1500w"
      otherServices={OTHER}
    />
  );
}
