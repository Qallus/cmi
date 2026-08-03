import type { Metadata } from "next";
import { MicroLanding, type MicroLandingContent } from "@/components/site/micro-landing";

export const metadata: Metadata = {
  title: "Design. Build. Enjoy. — A Better Way to Build in Arizona",
  description:
    "Design-build custom homes, renovations, and additions across Greater Phoenix — one accountable team from first sketch to final walkthrough. By Constructed Matter, Inc.",
  alternates: { canonical: "https://designbuildenjoy.com/" },
  openGraph: {
    title: "Design. Build. Enjoy.",
    description: "One team, one process, zero finger-pointing. Build your dream space with Constructed Matter.",
    url: "https://designbuildenjoy.com/",
    type: "website",
  },
};

const content: MicroLandingContent = {
  brand: "Design · Build · Enjoy",
  source: "DesignBuildEnjoy.com",
  domain: "designbuildenjoy.com",
  theme: "light",
  heroImage: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/589cd039-0f3e-488c-a28a-dc00086c6c8a/Conrad+Residence-13.jpg",
  eyebrow: "The Design-Build Experience",
  headline: "Design. Build.",
  headlineTwist: "Enjoy.",
  sub: "Building should be exciting — not exhausting. Constructed Matter unites design and construction under one accountable team, so your project moves from first sketch to final walkthrough without the stress, surprises, or finger-pointing.",
  primaryCta: "Start Your Project",
  pitchTitle: "One team. One process. No hand-offs.",
  pitchBody:
    "Most builds break down in the gaps — between the designer and the contractor, the estimate and the invoice, the promise and the punch list. Design-build closes those gaps. You get a single partner responsible for the whole journey, and a process built to be transparent and genuinely enjoyable.",
  bullets: [
    { title: "Design that fits your budget", body: "We align vision and numbers from day one, so what we design is what you can actually build — no sticker shock at the end." },
    { title: "One point of accountability", body: "Design and construction under one roof means no blame games. One team owns the outcome, start to finish." },
    { title: "Transparent from start to finish", body: "Clear timelines, honest pricing, and steady communication at every stage — from permitting to the final walkthrough." },
    { title: "Craftsmanship you can feel", body: "Every material and detail is chosen with intention and built to last well beyond move-in day." },
    { title: "Built around your life", body: "Custom homes, renovations, additions, and ADUs designed to fit how you actually live." },
    { title: "Relationships that last", body: "We build for the long haul — most of our work comes from clients and neighbors who’ve been there before." },
  ],
  formTitle: "Let’s design something you’ll love.",
  formSub: "Tell us a little about your project and we’ll set up a free, no-pressure consultation to explore what’s possible.",
  formCta: "Request My Free Consultation",
};

export default function DesignBuildEnjoyPage() {
  return <MicroLanding content={content} />;
}
