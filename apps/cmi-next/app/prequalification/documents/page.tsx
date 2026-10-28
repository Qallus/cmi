import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";
import { DocumentsClient } from "./documents-client";

export const metadata = { title: "Upload Documents — Constructed Matter", robots: { index: false } };
export const dynamic = "force-dynamic";

// Where a trade partner sends missing, rejected or renewed documents after
// applying. Reached from the link in our follow-up and approval emails.
export default async function TradePartnerDocumentsPage() {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="border-b border-border bg-card/40 py-14 lg:py-16">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">Trade Partners</div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">Your documents</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Upload anything we&apos;ve asked for, or a renewed certificate before the old one expires. Our team reviews every upload.
            </p>
          </div>
        </section>
        <section className="bg-background py-14">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <DocumentsClient />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
