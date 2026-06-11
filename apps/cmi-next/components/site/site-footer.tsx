import Link from "next/link";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { ContactFab } from "./contact-fab";

const SERVICES_LINKS = [
  { label: "Residential",                        href: "/services/residential" },
  { label: "Commercial",                          href: "/services/commercial" },
  { label: "ADU",                                 href: "/services/adu" },
  { label: "Renovations & Additions",             href: "/services/renovations-additions" },
  { label: "Architectural & Design Coordination", href: "/services/architectural-design" },
  { label: "New Construction",                    href: "/services/new-construction" },
];

const COMPANY_LINKS = [
  { label: "About Us",   href: "/about" },
  { label: "Our Team",   href: "/team" },
  { label: "Portfolio",  href: "/portfolio" },
  { label: "Resources",  href: "/resources" },
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
              src="https://wp-constructedmatter-com-985548.hostingersite.com/wp-content/uploads/2026/03/CMI_Logo_White.svg"
              alt="Constructed Matter, Inc."
              className="h-9 w-auto"
            />
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Arizona's premier construction firm. Building spaces that endure, inspire, and reflect the people who live and work in them.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://www.facebook.com/ConstructedMatter/" target="_blank" rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-accent hover:text-accent">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/constructedmatter/" target="_blank" rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-accent hover:text-accent">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://www.linkedin.com/company/constructed-matter-inc/posts/?feedView=all" target="_blank" rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-accent hover:text-accent">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Services col */}
          <div>
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Services</div>
            <ul className="space-y-2.5">
              {SERVICES_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-white/60 transition hover:text-white">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company col */}
          <div>
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Company</div>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((item) => (
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
                <a href="https://www.google.com/maps/place/Constructed+Matter,+Inc/@33.4870402,-111.924356,17z" target="_blank" rel="noreferrer"
                  className="flex items-start gap-2.5 text-sm text-white/60 transition hover:text-white">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>7314 E Osborn Dr Suite A<br />Scottsdale, AZ 85251</span>
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
            <Link href="/privacy" className="transition hover:text-white/70">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-white/70">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
    <ContactFab />
    </>
  );
}
