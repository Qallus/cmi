import { notFound } from "next/navigation";
import { CheckCircle2, ClipboardList, HardHat, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";
import { ApplicationClient } from "./application-client";

export const metadata = {
  title: "Become a Trade Partner — Constructed Matter, Inc.",
  description:
    "Apply to work with Constructed Matter. Tell us about your trade, service area, capacity, licensing and insurance, and we'll be in touch about upcoming projects.",
};

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: ClipboardList, title: "Tell us about your company", body: "Your trade, where you work, the size of project that suits you, and how you price." },
  { icon: ShieldCheck, title: "Send your paperwork", body: "W-9, certificate of insurance, and your licence if you hold one. We verify before sending work." },
  { icon: HardHat, title: "Meet the team", body: "For most trades we'll set up a short call or site walk to go through scope and scheduling." },
  { icon: CheckCircle2, title: "Get on the bid list", body: "Approved partners are matched to projects by trade, service area and capacity." },
];

export default async function PrequalificationPage() {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="bg-background">
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-16">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Trade Partners</div>
            <h1 className="mt-2 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
              Build with Constructed Matter
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              We work with subcontractors, vendors, designers and consultants across the Valley on residential
              remodels, additions, casitas and custom homes. Tell us what you do and where you do it, and we&apos;ll
              match you to the work that fits.
            </p>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            {STEPS.map((s, i) => (
              <div key={s.title}>
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-accent"><s.icon className="h-4 w-4" /></span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Step {i + 1}</span>
                </div>
                <h2 className="mt-2 font-medium">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
            <ApplicationClient />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
