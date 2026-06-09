import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ContactForm } from "./contact-form";

export const metadata = { title: "Contact Us — Constructed Matter" };

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="border-b border-border bg-card/40 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">Get in Touch</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">
                Let&apos;s Start a<br /><span className="text-accent">Conversation</span>
              </h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Whether you have a project in mind or just want to learn more about what we do, we&apos;d love to hear from you. Our team typically responds within one business day.
              </p>
            </div>
          </div>
        </section>

        {/* Form + Sidebar */}
        <section className="bg-background py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid items-start gap-16 lg:grid-cols-[1fr_420px] lg:gap-20">
              <ContactForm />

              {/* Sidebar */}
              <div className="space-y-8">
                {/* Office Info */}
                <div className="rounded-2xl border border-border bg-card p-8">
                  <h3 className="mb-6 font-display text-xl font-semibold">Our Office</h3>
                  <ul className="space-y-5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <circle cx="12" cy="11" r="3" />
                      </svg>
                      <div>
                        <p className="mb-0.5 font-medium text-foreground">7314 E Osborn Dr Suite A</p>
                        <p>Scottsdale, AZ 85251</p>
                        <a
                          href="https://www.google.com/maps/place/Constructed+Matter,+Inc/@33.4870402,-111.924356,17z"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs text-accent hover:underline"
                        >
                          Get Directions &rarr;
                        </a>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="mb-0.5 font-medium text-foreground">Phone</p>
                        <a href="tel:+14806284458" className="transition hover:text-accent">(480) 628-4458</a>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="mb-0.5 font-medium text-foreground">Email</p>
                        <a href="mailto:hello@constructedmatter.com" className="transition hover:text-accent">hello@constructedmatter.com</a>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <div>
                        <p className="mb-0.5 font-medium text-foreground">Office Hours</p>
                        <p>Mon – Fri: 8:00 AM – 5:00 PM</p>
                        <p>Sat: By Appointment</p>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Book Consultation CTA */}
                <div className="rounded-2xl bg-accent p-8 text-white">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                    <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </div>
                  <h3 className="mb-2 font-display text-xl font-semibold">Book a Consultation</h3>
                  <p className="mb-5 text-sm leading-relaxed text-white/80">
                    Prefer to meet in person or over a call? Schedule a free 30-minute consultation with our team.
                  </p>
                  <a
                    href="https://wp-constructedmatter-com-985548.hostingersite.com/?fluent-booking=calendar&host=jwaters-1772651529&event=30min"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[13px] font-semibold text-accent transition hover:opacity-90"
                  >
                    Schedule Now
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
                  </a>
                </div>

                {/* License Badge */}
                <div className="flex items-center gap-4 rounded-xl border border-border p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Licensed, Bonded &amp; Insured</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">ROC License KB1 - 343120</p>
                  </div>
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
