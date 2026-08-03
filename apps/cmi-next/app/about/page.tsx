import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = { title: "About Us — Constructed Matter" };

const STORY_PARAGRAPHS = [
  "Constructed Matter began long before it became a full-blown construction company. Founded by Joe Ballard in 2014 while living in Minnesota, Constructed Matter was originally a creative outlet — a place to explore craftsmanship through printmaking, custom furniture, woodworking, metal fabrication, and handcrafted pieces. When Joe later moved to Arizona, the name and the philosophy came with him. At its core, Constructed Matter has always been about creating things with intention, craftsmanship, and pride.",
  "Joe and Brandon Fadden developed a friendship through church and life outside of work. As they got to know each other, they discovered they shared another passion — construction. With years of experience on different paths within the industry, countless conversations naturally turned toward what they believed the building experience should be. They saw an opportunity to create something different: a company where craftsmanship, communication, honesty, and relationships mattered just as much as the finished product.",
  "In 2021, that shared vision became reality when Brandon and Joe partnered to transform Constructed Matter into a fully committed general contracting firm. Together, they combined decades of experience with a genuine desire to raise the standard for the client experience — making the construction process more transparent, collaborative, and enjoyable from start to finish.",
  "Today, Constructed Matter builds custom homes, transformative renovations, commercial spaces, and meaningful places throughout Arizona. While the company has evolved, its foundation remains the same: thoughtful craftsmanship, honest communication, and a commitment to building relationships that last well beyond the final walkthrough. Because at Constructed Matter, we believe the best projects aren't just well built — they're well experienced.",
];

const VALUES = [
  {
    title: "Uncompromising Quality",
    body: "We never cut corners. Every material, every detail, every finish is selected with care and built to last beyond expectations.",
    icon: (
      <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: "Radical Transparency",
    body: "No surprises, no runarounds. We keep you informed at every stage, from permitting to punch list, with clear communication and honest timelines.",
    icon: (
      <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    ),
  },
  {
    title: "True Partnership",
    body: "Your project is our project. We invest in understanding your vision and remain your advocates from first conversation to final walkthrough.",
    icon: (
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
  },
  {
    title: "Community Rooted",
    body: "We live and work in Arizona. We source locally, hire locally, and invest in the communities where our projects stand.",
    icon: (
      <>
        <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  },
  {
    title: "Innovation in Practice",
    body: "We embrace modern building methods, sustainable materials, and smart technology to deliver projects that are efficient, beautiful, and future-ready.",
    icon: (
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    ),
  },
  {
    title: "Licensed & Accountable",
    body: "Fully licensed, bonded, and insured. We hold our work, and ourselves, to the highest professional and ethical standards.",
    icon: (
      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    ),
  },
];

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-black pt-0">
          <div className="relative z-10 mx-auto max-w-7xl px-5 py-28 lg:px-8 lg:py-40">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">Our Story</div>
              <h1 className="mt-5 font-display text-5xl font-semibold leading-tight text-white sm:text-6xl lg:text-7xl">
                Built on<br /><span className="text-accent">Trust</span> &<br />Craftsmanship
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70 lg:text-lg">
                Constructed Matter began long before it became a construction company — built on intention, craftsmanship, and pride.
              </p>
            </div>
          </div>
        </section>

        {/* ── Our Story ── */}
        <section className="border-b border-border bg-background py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Our Story</div>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">
              How Constructed Matter Came to Be
            </h2>
            <div className="mt-8 max-w-4xl space-y-6">
              {STORY_PARAGRAPHS.map((paragraph, i) => (
                <p key={i} className="text-base leading-8 text-muted-foreground">{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who We Are ── */}
        <section className="border-b border-border bg-card/40 py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">Who We Are</div>
                <h2 className="mt-4 font-display text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">
                  A Turnkey Construction Firm Driven by Design
                </h2>
                <p className="mt-6 leading-relaxed text-muted-foreground">
                  Constructed Matter Inc. was founded on a simple belief: every project is a partnership. Whether you're building your dream home, expanding your business, or investing in your property, you deserve a team that listens, communicates openly, and delivers without compromise.
                </p>
                <p className="mt-5 leading-relaxed text-muted-foreground">
                  From our base in Scottsdale, Arizona, we serve the entire Greater Phoenix Metro Area with residential construction, commercial build-outs, ADU development, interior design, and comprehensive project management.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link href="/team" className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent">
                    Meet the Team <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/contact" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                    Contact Us &rarr;
                  </Link>
                </div>
              </div>
              <div className="relative">
                <img
                  src="/team/brandon-and-joe-optimized.webp"
                  alt="Brandon Fadden and Joseph Ballard — Managing Partners"
                  className="aspect-[4/5] w-full rounded-2xl object-cover object-top"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Core Values ── */}
        <section className="border-b border-border bg-background py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-16 text-center">
              <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">What Drives Us</div>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight lg:text-5xl">Our Core Values</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {VALUES.map((v) => (
                <div key={v.title} className="rounded-2xl border border-border bg-card p-8 transition hover:border-accent/40">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                    <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      {v.icon}
                    </svg>
                  </div>
                  <h3 className="font-display text-xl font-semibold">{v.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative overflow-hidden py-24 text-center text-white lg:py-32">
          <img
            src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1920&q=80"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/85" />
          <div className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">Work With Us</div>
            <h2 className="mt-5 font-display text-4xl font-semibold tracking-tight lg:text-5xl">
              Ready to Start Your Next Project?
            </h2>
            <p className="mx-auto mt-6 max-w-lg leading-relaxed text-white/70">
              Join the hundreds of Arizona homeowners and business owners who have trusted Constructed Matter to bring their vision to life.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-4 text-sm font-semibold text-white transition hover:bg-accent/90">
                Let&apos;s Build Together <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/team" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                Meet the Team
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
