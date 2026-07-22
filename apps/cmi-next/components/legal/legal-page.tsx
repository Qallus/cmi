import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

/** Canonical public URLs for the compliance pages. Imported everywhere that
 *  cross-links between them so the set stays consistent. */
export const LEGAL_ROUTES = {
  privacy: "/privacy-policy",
  terms: "/terms-of-service",
  smsOptIn: "/sms-opt-in",
  smsOptOut: "/sms-opt-out",
  emailOptIn: "/email-opt-in",
  emailOptOut: "/email-opt-out",
} as const;

export const LEGAL_NAV = [
  { href: LEGAL_ROUTES.privacy, label: "Privacy Policy" },
  { href: LEGAL_ROUTES.terms, label: "Terms of Service" },
  { href: LEGAL_ROUTES.smsOptIn, label: "SMS Opt-In" },
  { href: LEGAL_ROUTES.smsOptOut, label: "SMS Opt-Out" },
  { href: LEGAL_ROUTES.emailOptIn, label: "Email Opt-In" },
  { href: LEGAL_ROUTES.emailOptOut, label: "Email Opt-Out" },
];

export const CMI_CONTACT = {
  legalName: "Constructed Matter, Inc.",
  phone: "(480) 628-4458",
  phoneHref: "tel:+14806284458",
  email: "hello@constructedmatter.com",
  addressLine: "7314 E Osborn Dr, Suite A",
  addressCityStateZip: "Scottsdale, AZ 85251",
} as const;

/**
 * Shared chrome for the long-form legal documents (Privacy Policy, Terms of
 * Service). Body content is authored as semantic HTML inside `.cmi-legal`,
 * which supplies the typography.
 */
export function LegalPageLayout({
  title,
  effectiveDate,
  intro,
  currentHref,
  children,
}: {
  title: string;
  effectiveDate: string;
  intro?: string;
  /** This page's own route, so it is excluded from the cross-link list. */
  currentHref: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="bg-background">
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-16">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Legal</div>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight lg:text-5xl">{title}</h1>
            <p className="mt-4 text-sm text-muted-foreground">Effective date: {effectiveDate}</p>
            {intro ? <p className="mt-4 max-w-4xl text-base leading-8 text-muted-foreground">{intro}</p> : null}
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <article className="cmi-legal">{children}</article>

          <LegalCrossLinks currentHref={currentHref} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Links between every compliance page. Rendered at the foot of each one. */
export function LegalCrossLinks({ currentHref }: { currentHref: string }) {
  const others = LEGAL_NAV.filter((item) => item.href !== currentHref);
  return (
    <nav aria-label="Related legal pages" className="mt-16 border-t border-border pt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Related pages
      </h2>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {others.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <address className="mt-8 text-sm not-italic leading-7 text-muted-foreground">
        <strong className="font-semibold text-foreground">{CMI_CONTACT.legalName}</strong>
        <br />
        {CMI_CONTACT.addressLine}
        <br />
        {CMI_CONTACT.addressCityStateZip}
        <br />
        Phone:{" "}
        <a href={CMI_CONTACT.phoneHref} className="text-accent underline-offset-4 hover:underline">
          {CMI_CONTACT.phone}
        </a>
        <br />
        Email:{" "}
        <a href={`mailto:${CMI_CONTACT.email}`} className="text-accent underline-offset-4 hover:underline">
          {CMI_CONTACT.email}
        </a>
      </address>
    </nav>
  );
}
