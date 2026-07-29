import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { fallbackTeamMembers, slugForTeamMember } from "@/lib/team/fallback";
import { loadActiveTeamMembers } from "@/lib/team/data";
import { mergeTeamMemberWithFallback, normalizeTeamMember } from "@/lib/team/normalize";
import type { TeamMember } from "@/lib/team/types";

export const metadata = { title: "Our Team - Constructed Matter" };

// Render live so team edits (photos, bios, order) appear immediately instead of
// serving a build-time snapshot.
export const dynamic = "force-dynamic";

async function getTeamMembers() {
  try {
    const members = await loadActiveTeamMembers();
    if (!members.length) return fallbackTeamMembers;
    return members.map(member => {
      const fallback = fallbackTeamMembers.find(item => slugForTeamMember(item) === slugForTeamMember(member));
      return mergeTeamMemberWithFallback(member, fallback);
    });
  } catch {
    return fallbackTeamMembers.map(normalizeTeamMember);
  }
}

function TeamCard({ member, detailed = false }: { member: TeamMember; detailed?: boolean }) {
  const slug = slugForTeamMember(member);
  const chips = member.attributes ?? [];
  const photo = member.profile_photo || "/team/brandon-and-joe-optimized.webp";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/team/${slug}`} className="absolute inset-0 z-10" aria-label={`View ${member.name}'s profile`} />
      <div className="relative aspect-[3/4] overflow-hidden">
        {/* Photos turn black & white on hover. Primary grayscales; the alternate
            portrait (when present) fades in already grayscale. */}
        <img
          src={photo}
          alt={member.name}
          className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:grayscale"
        />
        {member.secondary_photo ? (
          <img
            src={member.secondary_photo}
            alt={`${member.name} alternate portrait`}
            className="absolute inset-0 h-full w-full object-cover object-center opacity-0 grayscale transition duration-500 group-hover:opacity-100"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="relative z-20 p-6">
        {member.role ? <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">{member.role}</p> : null}
        <h3 className="mt-1 font-display text-xl font-semibold">{member.name}</h3>
        {member.tagline ? <p className="mt-1 text-xs italic text-muted-foreground">{member.tagline}</p> : null}
        {detailed && member.bio ? <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-muted-foreground">{member.bio}</p> : null}
        {chips.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map(chip => (
              <span key={chip} className="rounded-full border border-border px-3 py-0.5 text-[11px] text-muted-foreground">{chip}</span>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex items-center border-t border-border pt-4">
          <Link href={`/team/${slug}`} className="relative z-30 ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:text-accent/75">
            View Profile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function TeamPage() {
  const members = await getTeamMembers();

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="border-b border-border bg-card/40 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">The People Behind the Projects</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">Meet Our Team</h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Our strength is our people. From our internal team to our partnered architects and skilled tradespeople, every member of the CMI team brings expertise, passion, and a deep commitment to doing the job right.
              </p>
              <p className="mt-4 text-xs italic text-muted-foreground">Hover over a team member's photo to see a different side of them.</p>
            </div>
          </div>
        </section>

        <section className="bg-background py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-14">
              <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">The People Behind the Projects</div>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight lg:text-4xl">The Team</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {members.map(member => (
                <TeamCard key={member.id} member={member} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-background py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Join the CMI Family</div>
                <h2 className="mt-4 font-display text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">
                  We're Always Looking for Great People
                </h2>
                <p className="mt-5 leading-relaxed text-muted-foreground">
                  Whether you're an experienced project manager, a skilled tradesperson, or someone looking to build a career in construction, we want to hear from you.
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
              <img
                src="/team/brandon-and-joe-optimized.webp"
                alt="Constructed Matter leadership"
                className="w-full rounded-2xl object-cover object-top"
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
