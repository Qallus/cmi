import { LandingPage, type LandingPageContent } from "@/components/site/landing-page";

export const metadata = {
  title: "ADU and Casita Construction | Constructed Matter",
  description: "Design and build an ADU, casita, guest house, office, or private secondary living space with Constructed Matter.",
};

const content: LandingPageContent = {
  eyebrow: "ADU / Casita Addition",
  title: "Add More Living Space",
  accent: "Without Leaving Home.",
  subtitle:
    "Whether you need space for family, guests, rental potential, a private office, or a retreat of your own, Constructed Matter helps homeowners design and build ADUs and casitas that feel intentional, beautiful, and connected to the property.",
  primaryCta: "Schedule an ADU Consultation",
  secondaryCta: "Explore Casita Options",
  secondaryHref: "#options",
  heroImage: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1738197942145-FYBTLO37J2J62G10XHFK/CMI_Ambassador_ADU_12.jpg?format=1800w",
  painTitle: "What is an ADU or casita?",
  painBody:
    "An ADU, accessory dwelling unit, or casita is a secondary living space added to your property. It can be attached to the main home, detached in the backyard, or designed as a private guest house depending on the property, local requirements, and homeowner goals.",
  painPoints: [
    "Create flexible living space on your property",
    "Support family, guests, or multi-generational living",
    "Add a private office, studio, gym, or retreat",
    "Improve how the property works day to day",
    "Explore long-term rental or guest-use potential",
    "Design a space that feels connected to the home",
  ],
  valueTitle: "More than extra space",
  valueBody:
    "A well-planned ADU can give your property new flexibility, whether the goal is family support, privacy, work-from-home space, guest accommodations, or a future-focused improvement.",
  features: [
    { title: "Family Space", body: "Give loved ones privacy and independence while keeping them close to home.", icon: "home" },
    { title: "Guest House", body: "Create a welcoming place for visiting family, friends, or long-term guests.", icon: "door" },
    { title: "Aging Parent Suite", body: "Support multi-generational living with a thoughtful, private living environment.", icon: "bed" },
    { title: "Adult Children", body: "Offer flexible space for extended family with separation from the main home.", icon: "building" },
    { title: "Rental Potential", body: "Depending on local rules and property setup, an ADU may create income opportunities.", icon: "briefcase" },
    { title: "Private Office", body: "Build a quiet workspace away from the distractions of the main house.", icon: "office" },
    { title: "Creative Studio", body: "Design a gym, studio, music room, pool house, or hobby space.", icon: "drafting" },
    { title: "Long-Term Value", body: "Add lasting flexibility with a space that can adapt as your needs change.", icon: "panels" },
  ],
  highlightTitle: "Keep family close while giving everyone their own space",
  highlightBody:
    "A casita can provide independence and privacy while keeping loved ones nearby. This can be ideal for aging parents, visiting family, adult children, caregivers, or long-term guests.",
  highlightItems: [
    "Private bedroom and bathroom",
    "Comfortable living area",
    "Kitchenette or full kitchen",
    "Private entrance",
    "Patio or outdoor connection",
    "Laundry and storage",
    "Accessible planning considerations",
    "Separation from the main home",
  ],
  columnsTitle: "Designed around your property and lifestyle",
  columnsBody:
    "Every property is different. We help homeowners think through placement, circulation, exterior character, interior finishes, and practical feasibility before construction begins.",
  columns: [
    {
      title: "Lifestyle Uses",
      items: ["Guest suite", "Parent suite", "Adult child space", "Home office", "Fitness space", "Design studio", "Pool house", "Quiet retreat"],
    },
    {
      title: "Design Possibilities",
      items: ["Bedroom and bathroom", "Living area", "Kitchenette", "Private entry", "Outdoor patio", "Laundry", "Energy-efficient design", "Matching exterior finishes"],
    },
  ],
  whyTitle: "A practical design/build partner for ADUs and casitas",
  whyBody:
    "CMI brings design thinking, construction experience, and project management together so your ADU is planned with care from feasibility through final walkthrough.",
  whyPoints: [
    "Thoughtful planning",
    "Design and construction experience",
    "Clear communication",
    "Quality craftsmanship",
    "Local project understanding",
    "Functional layouts",
    "Premium finishes",
    "Concept-to-completion management",
  ],
  processTitle: "From idea to feasibility to build",
  processSteps: ["Initial consultation", "Property and goals review", "Feasibility discussion", "Design direction", "Scope and budget planning", "Permitting and preparation", "Construction", "Final walkthrough"],
  ctaTitle: "Thinking about adding a casita or ADU?",
  ctaBody:
    "Let's explore what is possible on your property and how an ADU could add flexibility, comfort, and long-term value.",
  ctaButton: "Schedule a Consultation",
};

export default function AduCasitaPage() {
  return <LandingPage content={content} />;
}
