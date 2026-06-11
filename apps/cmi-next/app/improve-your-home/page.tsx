import { LandingPage, type LandingPageContent } from "@/components/site/landing-page";

export const metadata = {
  title: "Improve Your Current Home | Constructed Matter",
  description: "Explore remodeling, additions, and whole-home improvements with Constructed Matter before shopping for a new house.",
};

const content: LandingPageContent = {
  eyebrow: "Improve Your Current Home",
  title: "Love Your Location.",
  accent: "Reimagine Your Home.",
  subtitle:
    "Your home may already have the location, memories, and foundation you love. Constructed Matter helps homeowners add square footage, improve functionality, and transform interior and exterior spaces into something that feels brand new.",
  primaryCta: "Schedule a Consultation",
  secondaryCta: "Explore Remodeling Options",
  secondaryHref: "#options",
  heroImage: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/1738363725187-C9L2JWZOXXQT2M517PCG/Keim-10.jpg?format=1800w",
  painTitle: "Why buy new when you can build more into the home you already love?",
  painBody:
    "Buying a different home can mean higher costs, moving stress, competitive inventory, unknown repairs, and leaving the neighborhood that already works for your life. A thoughtful remodel can help you stay rooted while creating a home that fits the way you live now.",
  painPoints: [
    "Stay in the area you love",
    "Add the space your family needs",
    "Modernize outdated interiors",
    "Improve curb appeal and outdoor living",
    "Increase long-term usability and comfort",
    "Customize the home around your lifestyle",
  ],
  valueTitle: "Create the home you wanted without starting over",
  valueBody:
    "CMI helps homeowners evaluate the smartest path forward, from focused kitchen and bathroom remodels to additions, exterior upgrades, and full transformations.",
  features: [
    { title: "Home Additions", body: "Add bedrooms, living space, offices, or guest suites with a plan that respects the existing structure.", icon: "home" },
    { title: "Kitchen Remodels", body: "Create a better gathering space with improved flow, cabinetry, lighting, counters, and finishes.", icon: "panels" },
    { title: "Bathroom Remodels", body: "Refresh daily routines with thoughtful layouts, materials, lighting, and durable details.", icon: "bath" },
    { title: "Outdoor Living", body: "Connect the home to patios, shade, landscape, pool areas, and spaces for Arizona living.", icon: "trees" },
    { title: "Primary Suites", body: "Build a calmer retreat with more storage, better privacy, and a bath that feels intentional.", icon: "bed" },
    { title: "Garage Conversions", body: "Turn underused square footage into a studio, office, guest room, or flexible living area.", icon: "door" },
    { title: "Exterior Upgrades", body: "Modernize the facade, entry, openings, materials, and curb appeal.", icon: "building" },
    { title: "Whole-Home Remodels", body: "Rework the full home around better flow, finishes, function, and long-term value.", icon: "drafting" },
  ],
  highlightTitle: "Add the space your family needs",
  highlightBody:
    "A better home does not always require a new address. We can help you study practical ways to add livable square footage, improve flow, enlarge gathering spaces, and create rooms that match your next chapter.",
  highlightItems: [
    "Larger kitchen and dining space",
    "Expanded living room",
    "New bedroom or guest suite",
    "Larger primary suite",
    "Home office",
    "Garage conversion",
    "Indoor/outdoor living expansion",
    "Improved storage and daily flow",
  ],
  columnsTitle: "Modernize the inside. Elevate the outside.",
  columnsBody:
    "The best remodels feel cohesive. We look at interior function, exterior presence, materials, light, and the everyday experience of moving through the home.",
  columns: [
    {
      title: "Interior Improvements",
      items: ["Kitchens", "Bathrooms", "Flooring", "Lighting", "Cabinetry", "Layout improvements", "Finishes and materials", "Storage planning"],
    },
    {
      title: "Exterior Improvements",
      items: ["Curb appeal", "Facade updates", "Outdoor patios", "Backyard improvements", "Entryway upgrades", "Windows and doors", "Exterior materials", "Shade and outdoor comfort"],
    },
  ],
  whyTitle: "A design-forward construction partner for what comes next",
  whyBody:
    "Constructed Matter brings planning, craftsmanship, communication, and project management together so your remodel feels organized from the first conversation through the final walkthrough.",
  whyPoints: [
    "Thoughtful planning",
    "Clear communication",
    "High-quality craftsmanship",
    "Design and construction experience",
    "Organized project management",
    "Local remodeling expertise",
    "Long-term value mindset",
    "Detail-oriented execution",
  ],
  processTitle: "A clear path from idea to build",
  processSteps: ["Consultation", "Existing home review", "Design and scope planning", "Budget alignment", "Construction planning", "Build and project updates", "Final walkthrough"],
  ctaTitle: "Ready to make your current home feel new again?",
  ctaBody:
    "Before you start shopping for a new house, let's explore what is possible with the home you already own.",
  ctaButton: "Schedule a Consultation",
};

export default function ImproveYourHomePage() {
  return <LandingPage content={content} />;
}
