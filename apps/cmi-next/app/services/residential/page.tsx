import { ServicePageLayout } from "@/components/site/service-page-layout";

export const metadata = { title: "Residential Construction — Constructed Matter" };

const OTHER = [
  { title: "Commercial", subtitle: "Office & retail spaces", href: "/services/commercial" },
  { title: "ADU", subtitle: "Accessory dwelling units", href: "/services/adu" },
  { title: "Renovations & Additions", subtitle: "Expert oversight", href: "/services/renovations-additions" },
  { title: "Architectural & Design", subtitle: "Spaces that reflect you", href: "/services/architectural-design" },
  { title: "New Construction", subtitle: "Ground-up builds", href: "/services/new-construction" },
];

export default function ResidentialPage() {
  return (
    <ServicePageLayout
      category="Residential"
      headline={"Custom Homes<br/>Built to Last"}
      subheadline="Crafting bespoke residences that blend Arizona living with timeless design, from single-family homes to luxury custom builds."
      heroImage="https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1738363725187-C9L2JWZOXXQT2M517PCG/Keim-10.jpg?format=1500w"
      stats={[
        { value: "150+", label: "Homes Built" },
        { value: "4,800", label: "Avg. Sq Ft" },
        { value: "98%", label: "Client Satisfaction" },
      ]}
      description={[
        "Your Dream Home,<br/>Our Craft",
        "At Constructed Matter, residential construction is more than building walls — it's creating the setting for your life's most important moments. We combine meticulous craftsmanship with modern building science to deliver homes that are beautiful, energy-efficient, and built for the Arizona climate.",
        "From the initial design consultation through final walkthrough, our team manages every detail. We source premium materials, coordinate licensed subcontractors, and maintain transparent communication so you're never left wondering about your project's status.",
      ]}
      features={[
        { title: "Custom Floor Plans", body: "Designed around how you live, not a builder's catalog.", icon: <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /> },
        { title: "Energy Efficiency", body: "High-performance insulation, windows, and HVAC for Arizona summers.", icon: <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /> },
        { title: "Licensed & Insured", body: "AZ ROC licensed general contractor with full liability coverage.", icon: <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { title: "Budget Transparency", body: "Detailed line-item estimates and real-time cost tracking.", icon: <path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /> },
        { title: "On-Time Delivery", body: "Milestone-driven scheduling with proactive delay management.", icon: <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /> },
        { title: "Dedicated PM", body: "A single point of contact from groundbreak to move-in.", icon: <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /> },
      ]}
      ctaHeadline="Let's Design Your Future Home"
      ctaBody="Schedule a free consultation with our residential team and see how CMI turns vision into structure."
      ctaBg="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=80"
      otherServices={OTHER}
    />
  );
}
