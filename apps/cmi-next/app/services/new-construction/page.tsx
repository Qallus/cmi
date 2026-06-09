import { ServicePageLayout } from "@/components/site/service-page-layout";

export const metadata = { title: "New Construction — Constructed Matter" };

const OTHER = [
  { title: "Residential", subtitle: "Custom homes", href: "/services/residential" },
  { title: "Commercial", subtitle: "Office & retail spaces", href: "/services/commercial" },
  { title: "ADU", subtitle: "Accessory dwelling units", href: "/services/adu" },
  { title: "Renovations & Additions", subtitle: "Updates & expansions", href: "/services/renovations-additions" },
  { title: "Architectural & Design", subtitle: "Spaces that reflect you", href: "/services/architectural-design" },
];

export default function NewConstructionPage() {
  return (
    <ServicePageLayout
      category="New Construction"
      headline={"Ground-Up Builds<br/>Built to Endure"}
      subheadline="From foundation to final walkthrough, every phase is handled with uncompromising standards and expert oversight."
      heroImage="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/2dc42c14-bea2-4bcb-b8bd-d24b7b9cf1e7/Duff+Residence-2.jpg?format=1500w"
      stats={[
        { value: "40+", label: "New Construction Projects" },
        { value: "6,200", label: "Avg. Sq Ft" },
        { value: "98%", label: "On-Budget Delivery" },
      ]}
      description={[
        "Built Right<br/>From the Foundation",
        "New construction is the ultimate blank canvas — and the most demanding test of a builder's capability. Constructed Matter brings full general contracting expertise to every ground-up build, managing site work, foundation, framing, MEP, finishes, and landscaping under one roof.",
        "We specialize in single-family residential, multi-family, and boutique commercial new construction across the Greater Phoenix Metro Area. Our project managers keep every phase on schedule, on budget, and aligned with the design intent.",
      ]}
      features={[
        { title: "Site & Civil Work", body: "Grading, utilities, and foundation handled with precision.", icon: <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h2m4 0h2m-6 4h2m4 0h2" /> },
        { title: "Framing & Structure", body: "Wood or steel framing built to Arizona wind and seismic standards.", icon: <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /> },
        { title: "Full MEP", body: "Mechanical, electrical, plumbing, and fire systems coordinated in-house.", icon: <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /> },
        { title: "Custom Finishes", body: "Premium material selections tailored to your design vision.", icon: <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /> },
        { title: "Inspections & QC", body: "Third-party inspection coordination and our own quality walk at each phase.", icon: <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { title: "Dedicated PM", body: "A single project manager from permit to CO.", icon: <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /> },
      ]}
      ctaHeadline="Ready to Build from the Ground Up?"
      ctaBody="Talk to our new construction team about your site, timeline, and vision — no obligation."
      ctaBg="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/2dc42c14-bea2-4bcb-b8bd-d24b7b9cf1e7/Duff+Residence-2.jpg?format=1500w"
      otherServices={OTHER}
    />
  );
}
