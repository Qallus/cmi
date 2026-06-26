import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Clock3, Linkedin, Mail, Phone, Users } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { fallbackTeamMembers, slugForTeamMember } from "@/lib/team/fallback";
import { loadTeamMemberBySlug } from "@/lib/team/data";
import { getTeamAttributeDetails, mergeTeamMemberWithFallback, normalizeTeamMember, type TeamAttributeDetail } from "@/lib/team/normalize";
import type { TeamMember } from "@/lib/team/types";

// Always render the latest profile data.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

type TeamProfile = {
  member: TeamMember;
  attributeDetails: TeamAttributeDetail[];
};

async function getMember(slug: string): Promise<TeamProfile | null> {
  const fallback = fallbackTeamMembers.find(member => slugForTeamMember(member) === slug);

  try {
    const member = await loadTeamMemberBySlug(slug);
    if (member) {
      const attributeDetails = getTeamAttributeDetails(member);
      return {
        member: mergeTeamMemberWithFallback(member, fallback),
        attributeDetails: attributeDetails.length ? attributeDetails : getTeamAttributeDetails(fallback ? normalizeTeamMember(fallback) : member)
      };
    }
  } catch {
    // Fall back for local demo mode.
  }

  return fallback ? { member: normalizeTeamMember(fallback), attributeDetails: getTeamAttributeDetails(fallback) } : null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const profile = await getMember(slug);
  const member = profile?.member;
  return {
    title: member ? `${member.name} - Constructed Matter` : "Team Member - Constructed Matter",
    description: member?.tagline || member?.bio || "Meet the Constructed Matter team."
  };
}

export default async function TeamMemberPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getMember(slug);
  if (!profile) notFound();

  const { member, attributeDetails } = profile;
  const photo = member.profile_photo || "https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/03/Brandon_Joe.png";
  const chips = member.attributes ?? [];
  const phoneHref = member.phone ? `tel:${member.phone.replace(/[^+\d]/g, "")}` : null;
  const bioParagraphs = (member.bio ?? "").split(/\n{2,}/).map(text => text.trim()).filter(Boolean);
  const availabilityPieces = (member.availability ?? "")
    .split(/[,|]+/)
    .map(item => item.trim())
    .filter(Boolean);
  const iconSet = [BriefcaseBusiness, Users, CalendarDays];

  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-border bg-card/40 py-4">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href="/" className="transition hover:text-accent">Home</Link>
              <ArrowRight className="h-3 w-3 opacity-50" />
              <Link href="/team" className="transition hover:text-accent">Our Team</Link>
              <ArrowRight className="h-3 w-3 opacity-50" />
              <span className="font-medium text-foreground">{member.name}</span>
            </div>
          </div>
        </section>

        <section className="bg-background py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <Link href="/team" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-accent">
              <ArrowLeft className="h-4 w-4" />
              Back to Team
            </Link>

            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <aside>
                <div className="group overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img src={photo} alt={member.name} className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:opacity-0" />
                    {member.secondary_photo ? (
                      <img
                        src={member.secondary_photo}
                        alt={`${member.name} alternate portrait`}
                        className="absolute inset-0 h-full w-full object-cover object-center opacity-0 grayscale transition duration-500 group-hover:opacity-100"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-card p-6">
                  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contact</div>
                  <div className="space-y-3">
                    {member.email ? (
                      <a href={`mailto:${member.email}`} className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-accent">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Mail className="h-4 w-4" /></span>
                        <span>{member.email}</span>
                      </a>
                    ) : null}
                    {member.phone && phoneHref ? (
                      <a href={phoneHref} className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-accent">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Phone className="h-4 w-4" /></span>
                        <span>{member.phone}</span>
                      </a>
                    ) : null}
                    <a href="https://www.linkedin.com/company/constructed-matter-inc/posts/?feedView=all" target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-accent">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Linkedin className="h-4 w-4" /></span>
                      <span>LinkedIn Profile</span>
                    </a>
                  </div>
                </div>

                {(availabilityPieces.length || member.department) ? (
                  <div className="mt-6">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Availability</div>
                    <div className="flex flex-wrap gap-2">
                      {availabilityPieces.map(item => (
                        <span key={item} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          {item}
                        </span>
                      ))}
                      {member.department ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                          {member.department}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </aside>

              <div className="space-y-8">
                <div>
                  {member.role ? <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">{member.role}</div> : null}
                  <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight lg:text-6xl">{member.name}</h1>
                  {member.tagline ? <p className="mt-3 text-base italic text-muted-foreground">{member.tagline}</p> : null}
                  {chips.length ? (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {chips.map(chip => (
                        <span key={chip} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{chip}</span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {bioParagraphs.length ? (
                  <div className="space-y-5 text-base leading-8 text-muted-foreground">
                    {bioParagraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                ) : null}

                {attributeDetails.length ? (
                  <div className="border-t border-border pt-8">
                    <div className="mb-6 flex items-end justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">What Sets {member.name.split(" ")[0]} Apart</div>
                        <h2 className="mt-2 font-display text-2xl font-semibold">Key Attributes</h2>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {attributeDetails.slice(0, 6).map((attribute, index) => {
                        const Icon = iconSet[index % iconSet.length];
                        return (
                          <article key={attribute.title} className="rounded-2xl border border-border bg-card p-6">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                              <Icon className="h-5 w-5" />
                            </span>
                            <h3 className="mt-5 font-display text-lg font-semibold">{attribute.title}</h3>
                            {attribute.description ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{attribute.description}</p> : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/book" className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                    Schedule With CMI
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/contact" className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent">
                    Contact the Team
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
