import { ServicePageLayout } from "@/components/site/service-page-layout";

export const metadata = { title: "ADU Construction — Constructed Matter" };

const OTHER = [
  { title: "Residential", subtitle: "Custom homes", href: "/services/residential" },
  { title: "Commercial", subtitle: "Office & retail spaces", href: "/services/commercial" },
  { title: "Renovations & Additions", subtitle: "Updates & expansions", href: "/services/renovations-additions" },
  { title: "Architectural & Design", subtitle: "Spaces that reflect you", href: "/services/architectural-design" },
  { title: "New Construction", subtitle: "Ground-up builds", href: "/services/new-construction" },
];

export default function AduPage() {
  return (
    <ServicePageLayout
      category="ADU"
      headline={"Unlock Your<br/>Property's Potential"}
      subheadline="Accessory dwelling units that maximize your property's value with turnkey permitting, design, and construction."
      heroImage="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/f8d1c98a-e6b7-4b1d-ab9e-3ce111e9b817/Kit+Detail+2.jpg"
      stats={[
        { value: "30+", label: "ADUs Built" },
        { value: "6 mo", label: "Avg. Timeline" },
        { value: "100%", label: "Permit Success Rate" },
      ]}
      description={[
        "Turnkey ADU<br/>From Permit to Keys",
        "An accessory dwelling unit is one of the smartest investments you can make in your Arizona property. Whether you're looking to add rental income, create space for family members, or increase resale value, a well-designed ADU delivers on all fronts.",
        "Constructed Matter handles the entire process — design, permits, utilities, construction, and final inspection. We know the Phoenix Metro permitting landscape inside and out, so your project moves forward without costly delays.",
      ]}
      features={[
        { title: "Turnkey Process", body: "We manage design, permits, construction, and city inspection end-to-end.", icon: <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { title: "Permitting Expertise", body: "Deep experience with Phoenix Metro ADU permit requirements.", icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6" /> },
        { title: "Utility Coordination", body: "Electric, plumbing, HVAC, and gas planned and installed properly.", icon: <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /> },
        { title: "Flexible Designs", body: "Studio, 1BR, 2BR, detached, and garage conversion options.", icon: <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /> },
        { title: "Budget Clarity", body: "Fixed-price contracts so you know exactly what you're getting.", icon: <path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /> },
        { title: "ROI Focused", body: "Designed to maximize rental yield and property value.", icon: <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /> },
      ]}
      ctaHeadline="Ready to Add an ADU?"
      ctaBody="Schedule a site visit and we'll assess your property's ADU potential at no charge."
      ctaBg="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/f8d1c98a-e6b7-4b1d-ab9e-3ce111e9b817/Kit+Detail+2.jpg"
      otherServices={OTHER}
    />
  );
}
