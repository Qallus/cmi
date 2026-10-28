import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, CalendarClock, FileSignature, FileText, ShieldCheck, Users } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";
import { INSURANCE_MINIMUMS } from "@/lib/prequal/minimums";

export const metadata = {
  title: "Become a Trade Partner — Constructed Matter",
  description: "How to pre-qualify as a subcontractor, supplier or consultant with Constructed Matter: what we ask for, what you'll need, and what happens next.",
};
export const dynamic = "force-dynamic";

// The 1–2 page overview a sub reads before applying (trade partner brief §4).
// Copy to be replaced/extended from the Trade Partner Onboarding Guide.

const STEPS = [
  { icon: FileText, title: "Apply online", body: "Tell us about your company, trades, service area and contacts. It takes about 15 minutes and saves as you go." },
  { icon: ShieldCheck, title: "Upload your documents", body: "Your W-9, certificate(s) of insurance and contractor license. You can submit without a certificate and add it later, but we can't issue work until it's on file." },
  { icon: FileSignature, title: "Sign the agreement", body: "Review and sign our Master Subcontractor Agreement right in the application. No separate DocuSign." },
  { icon: Users, title: "Review and onboarding", body: "Our team reviews every application. Approved partners receive our onboarding guide and join our trade partner directory for upcoming bids." },
];

const NEED = [
  "A completed W-9",
  "Certificate(s) of insurance (general liability, auto, workers' comp)",
  "Your contractor license (ROC) number, if you hold one",
  "Contacts for accounting, estimating, the field and after hours",
];

export default async function BecomeATradePartnerPage() {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="border-b border-border bg-card/40 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-accent">Trade Partners</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">
                Become a<br /><span className="text-accent">Trade Partner</span>
              </h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                We build custom homes, remodels, additions and casitas across the Valley, and we rely on skilled
                subcontractors, suppliers and consultants to do it. Here&apos;s what we ask of our partners and how to get started.
              </p>
              <Link href="/prequalification" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                Start the application <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-background py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-16 px-5 lg:grid-cols-[1fr_420px] lg:px-8">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight">How it works</h2>
              <ol className="mt-8 space-y-7">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex items-start gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                      <s.icon className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <div>
                      <p className="font-medium">{i + 1}. {s.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <h2 className="mt-16 font-display text-3xl font-semibold tracking-tight">Insurance minimums</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Per our Master Subcontractor Agreement, partners carry at least the following. Constructed Matter is named as
                additional insured where required.
              </p>
              <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
                {Object.values(INSURANCE_MINIMUMS).map((m) => (
                  <div key={m.label} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm">
                    <dt className="font-medium">{m.label}</dt>
                    <dd className="text-muted-foreground">{m.text}</dd>
                  </div>
                ))}
              </dl>

              <h2 className="mt-16 font-display text-3xl font-semibold tracking-tight">Staying current</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We track certificate expiration dates and send reminders before anything lapses, starting 45 days out.
                Each year we ask partners to confirm their information and send an updated W-9 and certificates.
                We can&apos;t issue new work while required documents are missing or expired.
              </p>
            </div>

            <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-border bg-card p-8">
                <h3 className="mb-4 font-display text-xl font-semibold">Have these ready</h3>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {NEED.map((n) => (
                    <li key={n} className="flex items-start gap-3"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{n}</li>
                  ))}
                </ul>
                <Link href="/prequalification" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                  Start the application <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> About 15 minutes. Your progress saves.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Questions?</p>
                <p className="mt-1">Email <a href="mailto:info@constructedmatter.com" className="text-accent hover:underline">info@constructedmatter.com</a> or call <a href="tel:+14806284458" className="text-accent hover:underline">(480) 628-4458</a>.</p>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
