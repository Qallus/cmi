import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { LegalCrossLinks } from "@/components/legal/legal-page";

/**
 * Chrome for the four consent pages (SMS/email × opt-in/opt-out).
 *
 * These pages are intentionally public — no authentication. Twilio's A2P 10DLC
 * review and CAN-SPAM both require the opt-in disclosure and the unsubscribe
 * path to be reachable without a login.
 */
export function ConsentPageLayout({
  eyebrow,
  title,
  intro,
  currentHref,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  currentHref: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="bg-background">
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-16">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">{eyebrow}</div>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight lg:text-5xl">{title}</h1>
            <div className="mt-5 max-w-4xl space-y-4 text-base leading-8 text-muted-foreground">{intro}</div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-16">
          {children}
          {aside && <div className="cmi-legal mt-16 border-t border-border pt-10">{aside}</div>}
          <LegalCrossLinks currentHref={currentHref} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
