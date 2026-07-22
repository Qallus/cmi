import Link from "next/link";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { ContactFab } from "./contact-fab";
import { FooterFlagLink } from "./footer-flag-link";

// Every service link points at the Services overview. The individual service
// pages stay live but are not linked from anywhere on the site yet.
const SERVICES_LINKS = [
  "Residential",
  "Commercial",
  "ADU",
  "Renovations & Additions",
  "Architectural & Design",
  "Pools & Landscaping",
].map((label) => ({ label, href: "/services" }));

const GOOGLE_MAPS_DIRECTIONS =
  "https://www.google.com/maps/dir//Constructed+Matter,+Inc,+7314+E+Osborn+Dr+Ste+A,+Scottsdale,+AZ+85251/@33.4837392,-111.9164779,15z/data=!4m8!4m7!1m0!1m5!1m1!1s0x4df60e56031f726f:0xcfc958dfa22a341f!2m2!1d-111.924356!2d33.4870402";

const APPLE_MAPS_DIRECTIONS =
  "https://maps.apple.com/place?place-id=I35F7B895019B0E6B&address=7314+E+Osborn+Dr%2C+Scottsdale%2C+AZ++85251%2C+United+States&coordinate=33.487028%2C-111.924287&name=Constructed+Matter%2C+Inc.&_provider=9902";

// Project Canvas is injected between Resources and Contact by FooterFlagLink,
// which gates it on the same feature flag the header uses.
const COMPANY_LINKS_BEFORE_CANVAS = [
  { label: "About Us",   href: "/about" },
  { label: "Our Team",   href: "/team" },
  { label: "Portfolio",  href: "/portfolio" },
  { label: "Resources",  href: "/resources" },
];

const COMPANY_LINKS_AFTER_CANVAS = [
  { label: "Contact",    href: "/contact" },
];

export function SiteFooter() {
  return (
    <>
    <footer className="bg-[#111111] text-white">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        {/* Top grid */}
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand col */}
          <div className="space-y-5">
            <img
              src="/brand/CMI_Line_Logo_White.svg"
              alt="Constructed Matter, Inc."
              className="h-9 w-auto"
            />
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Arizona's premier construction firm. Building spaces that endure, inspire, and reflect the people who live and work in them.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://www.facebook.com/ConstructedMatter/" target="_blank" rel="noreferrer" aria-label="Constructed Matter on Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-accent hover:text-accent">
                <Facebook aria-hidden="true" className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/constructedmatter/" target="_blank" rel="noreferrer" aria-label="Constructed Matter on Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-accent hover:text-accent">
                <Instagram aria-hidden="true" className="h-4 w-4" />
              </a>
              <a href="https://www.linkedin.com/company/constructed-matter-inc/posts/?feedView=all" target="_blank" rel="noreferrer" aria-label="Constructed Matter on LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-accent hover:text-accent">
                <Linkedin aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Services col */}
          <div>
            <Link href="/services" className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 transition hover:text-white/70">Services</Link>
            <ul className="space-y-2.5">
              {SERVICES_LINKS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-white/60 transition hover:text-white">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company col */}
          <div>
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Company</div>
            <ul className="space-y-2.5">
              {COMPANY_LINKS_BEFORE_CANVAS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-white/60 transition hover:text-white">{item.label}</Link>
                </li>
              ))}
              <FooterFlagLink flag="project_canvas" href="/project-canvas" label="Project Canvas" />
              {COMPANY_LINKS_AFTER_CANVAS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-white/60 transition hover:text-white">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact col */}
          <div>
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Get in Touch</div>
            <ul className="space-y-3">
              <li>
                <a href="tel:+14806284458" className="flex items-start gap-2.5 text-sm text-white/60 transition hover:text-white">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  (480) 628-4458
                </a>
              </li>
              <li>
                <a href="mailto:hello@constructedmatter.com" className="flex items-start gap-2.5 text-sm text-white/60 transition hover:text-white">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  hello@constructedmatter.com
                </a>
              </li>
              <li>
                <a href={GOOGLE_MAPS_DIRECTIONS} target="_blank" rel="noreferrer"
                  className="flex items-start gap-2.5 text-sm text-white/60 transition hover:text-white">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>7314 E Osborn Dr Suite A<br />Scottsdale, AZ 85251</span>
                </a>
              </li>
              <li>
                <a href={GOOGLE_MAPS_DIRECTIONS} target="_blank" rel="noreferrer" className="block pl-[26px] text-sm text-accent transition hover:text-white">
                  Google Maps &rarr;
                </a>
              </li>
              <li>
                <a href={APPLE_MAPS_DIRECTIONS} target="_blank" rel="noreferrer" className="block pl-[26px] text-sm text-accent transition hover:text-white">
                  Apple Maps &rarr;
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
          <div className="text-xs text-white/40">
            © 2026 Constructed Matter Inc. All rights reserved. &nbsp;·&nbsp; ROC License KB1 - 343120
          </div>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <Link href="/privacy-policy" className="transition hover:text-white/70">Privacy Policy</Link>
            <Link href="/terms-of-service" className="transition hover:text-white/70">Terms of Service</Link>
            <Link href="/sms-opt-out" className="transition hover:text-white/70">SMS Opt-Out</Link>
            <Link href="/email-opt-out" className="transition hover:text-white/70">Email Opt-Out</Link>
          </div>
        </div>
      </div>
    </footer>
    <ContactFab />
    </>
  );
}
