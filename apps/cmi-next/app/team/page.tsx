import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = { title: "Our Team — Constructed Matter" };

interface TeamMember {
  name: string;
  role: string;
  bio?: string;
  tagline?: string;
  photo: string;
  photoAlt?: string;
  chips: string[];
}

const LEADERSHIP: TeamMember[] = [
  {
    name: "Brandon Fadden",
    role: "Principal / President",
    tagline: "Builder, leader, and big-picture thinker. Unshakable under pressure, driven by integrity. Husband, father and outdoorsman.",
    bio: "With over two decades of construction experience and a degree in Construction Management from NAU, Brandon has overseen more than $200 million in construction — spanning multifamily, mixed-use, healthcare, retail, and industrial. As President of CMI, he leads with steady conviction, building strong teams and delivering spaces that are functional and lasting.",
    photo: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/Brandon-Fadden.webp",
    photoAlt: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/brandon_fadden_2.jpg",
    chips: ["Leadership", "Commercial", "Multifamily", "Construction Mgmt"],
  },
  {
    name: "Joseph Ballard",
    role: "Principal / Construction Manager",
    tagline: "Founder, designer, and deep thinker. Chronic mumbler, detail-obsessed visionary. Husband and father.",
    bio: "With over 20 years in the construction industry, Joe brings a rare combination of design sensibility, technical expertise, and boots-on-the-ground experience — managing high-end custom homes and commercial tenant improvement projects across the country. At CMI, Joe leads construction operations in the field: hands-on, solution-driven, and committed to getting every detail right.",
    photo: "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/11e8879b-0a8a-43df-8fa4-9ffb548f8e93/ConstructedMatter-LHP-26.jpg?format=1500w",
    photoAlt: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/joe_ballard_2-scaled.jpg",
    chips: ["Construction Management", "Custom Homes", "Commercial TI", "Field Operations"],
  },
  {
    name: "Ben Peck",
    role: "Project Manager",
    tagline: "Detail-oriented, quietly determined, and always thinking three steps ahead. Husband and father of two.",
    bio: "Ben's background spans both architecture and construction, giving him a rare dual lens on how ideas become buildings. His experience covers custom homes, tenant improvements, and multifamily — along with design coordination, permitting, zoning, entitlements, and on-site construction management.",
    photo: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/ben_peck.webp",
    photoAlt: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/ben_peck_2.png",
    chips: ["Renovations and Additions", "Architecture", "Permitting", "Design Coordination"],
  },
];

const STAFF: TeamMember[] = [
  {
    name: "Angel Gutierrez",
    role: "Field Operations Coordinator",
    photo: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/angel_gutierrez.webp",
    photoAlt: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/552aef38-63f0-4d7e-b0ac-1ede2cb13a2a.jpeg",
    chips: ["Field Operations", "Trade Coordination"],
  },
  {
    name: "Yovana Hernandez",
    role: "Executive Operations & Project Coordinator",
    photo: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/yovana_hernandez.webp",
    photoAlt: "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/04/IMG_7145-scaled-e1776128272358.png",
    chips: ["Operations", "Project Coordination", "Executive Support"],
  },
];

function TeamCard({ member, detailed = false }: { member: TeamMember; detailed?: boolean }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card">
      {/* Photo with hover */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={member.photo}
          alt={member.name}
          className="absolute inset-0 h-full w-full object-cover object-top transition duration-500"
        />
        {member.photoAlt && (
          <img
            src={member.photoAlt}
            alt={`${member.name} — alternate`}
            className="absolute inset-0 h-full w-full object-cover object-center opacity-0 transition duration-500 group-hover:opacity-100"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {/* Info */}
      <div className="p-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">{member.role}</p>
        <h3 className="mt-1 font-display text-xl font-semibold">{member.name}</h3>
        {member.tagline && (
          <p className="mt-1 text-xs italic text-muted-foreground">{member.tagline}</p>
        )}
        {detailed && member.bio && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{member.bio}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {member.chips.map((c) => (
            <span key={c} className="rounded-full border border-border px-3 py-0.5 text-[11px] text-muted-foreground">{c}</span>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
          <a href="mailto:hello@constructedmatter.com" aria-label="Email" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-accent">
            <Mail className="h-4 w-4" />
          </a>
          <a href="tel:+14806284458" aria-label="Phone" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-accent">
            <Phone className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* ── Hero ── */}
        <section className="border-b border-border bg-card/40 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">The People Behind the Projects</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">Meet Our Team</h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Our strength is our people. From project managers and architects to skilled tradespeople — every member of the CMI team brings expertise, passion, and a deep commitment to doing the job right.
              </p>
              <p className="mt-4 text-xs italic text-muted-foreground">Hover over a team member's photo to see a different side of them.</p>
            </div>
          </div>
        </section>

        {/* ── Leadership ── */}
        <section className="bg-background py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-14">
              <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Leadership</div>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight lg:text-4xl">Our Leadership Team</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {LEADERSHIP.map((m) => (
                <TeamCard key={m.name} member={m} detailed />
              ))}
            </div>
          </div>
        </section>

        {/* ── Supporting Staff ── */}
        <section className="border-t border-border bg-card/40 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-14">
              <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">The Team</div>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight lg:text-4xl">Supporting Staff</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {STAFF.map((m) => (
                <TeamCard key={m.name} member={m} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Join CTA ── */}
        <section className="border-t border-border bg-background py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Join the CMI Family</div>
                <h2 className="mt-4 font-display text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">
                  We&apos;re Always Looking for Great People
                </h2>
                <p className="mt-5 leading-relaxed text-muted-foreground">
                  Whether you&apos;re an experienced project manager, a skilled tradesperson, or someone looking to build a career in construction — we want to hear from you. Constructed Matter is a place where talent is recognized, work is meaningful, and people stay.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                    Get In Touch <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a href="mailto:hello@constructedmatter.com" className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent">
                    Send Your Resume
                  </a>
                </div>
              </div>
              <div className="relative">
                <img
                  src="https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/03/Brandon_Joe.png"
                  alt="Brandon and Joe — Constructed Matter leadership"
                  className="w-full rounded-2xl object-cover object-top"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
