import type { Metadata } from "next";
import { MicroLanding, type MicroLandingContent } from "@/components/site/micro-landing";

export const metadata: Metadata = {
  title: "Construction Sucks. It Doesn’t Have To. — Constructed Matter",
  description:
    "Ghosted contractors, blown budgets, endless delays. Construction has a reputation for a reason. Constructed Matter is building a better way across Greater Phoenix.",
  alternates: { canonical: "https://constructionsucks.com/" },
  openGraph: {
    title: "Construction Sucks. It Doesn’t Have To.",
    description: "We fixed the parts of building everyone hates. Meet Constructed Matter.",
    url: "https://constructionsucks.com/",
    type: "website",
  },
};

const content: MicroLandingContent = {
  brand: "Construction Sucks",
  source: "ConstructionSucks.com",
  domain: "constructionsucks.com",
  theme: "dark",
  heroImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1920&q=80",
  eyebrow: "Let’s Be Honest",
  headline: "Construction sucks.",
  headlineTwist: "It doesn’t have to.",
  sub: "You’ve heard the horror stories — maybe you’ve lived one. Contractors who ghost, budgets that balloon, timelines that slip for months. We built Constructed Matter to be the opposite of all that.",
  primaryCta: "Build the Right Way",
  painTitle: "Why does building have such a bad reputation?",
  pains: [
    "Contractors who stop returning calls mid-project",
    "“Final” quotes that keep climbing with every invoice",
    "Timelines that slip weeks — then months",
    "Change orders you never agreed to",
    "No one who’ll actually own the mistakes",
    "Feeling like a nuisance for asking questions",
  ],
  pitchTitle: "We fixed the parts everyone hates.",
  pitchBody:
    "Constructed Matter is a full-service design-build firm founded on a simple idea: the building experience should be as good as the finished product. Clear communication, honest pricing, real accountability — and craftsmanship that speaks for itself.",
  bullets: [
    { title: "We pick up the phone", body: "Steady, proactive communication at every stage. You’ll always know exactly where your project stands." },
    { title: "Honest, upfront pricing", body: "Transparent estimates and no surprise invoices. The number we give you is the number we stand behind." },
    { title: "Timelines we keep", body: "Realistic schedules and disciplined project management, so “done” actually means done." },
    { title: "One team that owns it", body: "Design and construction under one roof means accountability lands in one place — with us." },
    { title: "Built to last", body: "Thoughtful craftsmanship and quality materials on every project, big or small." },
    { title: "Relationships over transactions", body: "We’d rather earn a client for life than win a single job. Most of our work is repeat and referral." },
  ],
  formTitle: "Ready to build without the headaches?",
  formSub: "Tell us about your project and we’ll set up a free, no-pressure consultation. No ghosting — we promise.",
  formCta: "Get My Free Consultation",
};

export default function ConstructionSucksPage() {
  return <MicroLanding content={content} />;
}
