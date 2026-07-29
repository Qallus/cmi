import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Camera, Check, MapPin, Mic, PenTool, Pencil, Send, Shapes, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { isFeatureEnabled } from "@/lib/flags";
import { FEATURE_PROJECT_CANVAS_PUBLIC } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Project Canvas — Constructed Matter",
  description: "Sketch your next project right on photos of your space. Draw, pin notes, drop in elements, and let Bolt turn it into a brief for our team.",
};

const STEPS = [
  { n: "01", icon: Camera, title: "Capture your space", body: "Take photos or video right in the portal — or upload what you already have. Each shot becomes a scene in your project storyboard." },
  { n: "02", icon: Pencil, title: "Sketch on reality", body: "Draw, outline doors and walls with the node tool, drop pergolas and kitchens from the element library, and pin notes — typed or spoken — exactly where they belong." },
  { n: "03", icon: Send, title: "Send it to our team", body: "Bolt reads your whole canvas back as a written brief. One tap sends it straight to the CMI team — scenes, notes, voice memos and all." },
];

const TOOLS = [
  { icon: Pencil, title: "Draw", body: "Freehand markup with meaning: gold for ideas, red for “remove this,” green for “add here.”", tag: "Color-coded intent" },
  { icon: PenTool, title: "Shape", body: "Tap the corners of a door or window and the shape closes itself — clean outlines without a steady hand.", tag: "Node tool" },
  { icon: MapPin, title: "Pin notes", body: "Tap anywhere to leave a note anchored to that exact spot. Your ideas stay where they belong.", tag: "Anchored context" },
  { icon: Mic, title: "Voice pins", body: "Prefer talking? Drop a voice memo on the photo. We transcribe it and keep the audio.", tag: "Auto-transcribed" },
  { icon: Shapes, title: "Elements", body: "Pergolas, outdoor kitchens, French doors, fire pits — drag real construction elements into your scene.", tag: "Stamp library" },
  { icon: Sparkles, title: "Bolt assist", body: "Ask what an outdoor kitchen needs, get suggested pins, and hear your project read back to you.", tag: "AI design assistant" },
];

export default async function ProjectCanvasMarketingPage() {
  if (!(await isFeatureEnabled(FEATURE_PROJECT_CANVAS_PUBLIC))) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main-content">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-5 py-20 text-center lg:px-8 lg:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c87f3a]" /> New in the CMI Client Portal
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Stop describing your project. <span className="italic text-accent">Show us.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Project Canvas turns your phone into a design tool. Snap photos of your space, sketch right on top of them, pin your ideas — and Bolt, our AI design assistant, turns it all into a brief our team can build from.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/client/canvas" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                Start your canvas <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:border-accent/50">
                See how it works
              </a>
            </div>
            <p className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-[#2e7d5b]" /> Free for every CMI client &amp; prospect · Works on any phone or tablet · No app to install
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Already have an account? <Link href="/client/login" className="font-semibold text-accent hover:underline">Log in</Link>
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">How it works</span>
              <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">Three steps from idea to project brief.</h2>
              <p className="mt-3 text-muted-foreground">No CAD software. No shaky walkthrough videos emailed at midnight. Just your phone, your space, and a few taps.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent"><s.icon className="h-5 w-5" /></span>
                    <span className="font-mono text-sm text-muted-foreground">{s.n}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Toolset */}
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">The toolset</span>
              <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">Simple enough for anyone. Sharp enough for designers.</h2>
              <p className="mt-3 text-muted-foreground">Every tool was built for a thumb on a phone screen — and every mark you make means something to our build team.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((t) => (
                <div key={t.title} className="rounded-xl border border-border bg-card p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent"><t.icon className="h-5 w-5" /></span>
                  <h3 className="mt-3 text-base font-semibold">{t.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                  <span className="mt-3 inline-block rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bolt */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2 lg:px-8">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">Meet Bolt</span>
              <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">The moment you feel understood.</h2>
              <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                {[
                  "Bolt watches your canvas as you work and answers questions about materials, layout, and what to think through.",
                  "When you're done, Bolt reads the whole project back to you in plain language — before a human ever gets involved.",
                  "That same summary arrives with your brief, so our team starts the first conversation already on the same page.",
                ].map((li, i) => (
                  <li key={i} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2e7d5b]" />{li}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border p-6" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--border))", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-amber-400 text-white"><Sparkles className="h-4 w-4" /></span>
                <div><div className="text-sm font-semibold">Bolt · Project Read-Back</div><div className="text-[11px] text-muted-foreground">Generated from 3 scenes, 4 pins, 2 voice notes</div></div>
              </div>
              <blockquote className="mt-4 font-display text-lg leading-relaxed">“So you're looking to remove the existing concrete pad, add a 400 sq ft covered patio with an outdoor kitchen along the east wall, and swap the slider for French doors…”</blockquote>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["3 scenes", "4 pins", "2 voice notes", "~400 sq ft"].map((c) => <span key={c} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{c}</span>)}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:px-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">Available now in your client portal</span>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">Your project is already in your head. <span className="italic text-accent">Put it in front of us.</span></h2>
            <p className="mt-3 text-muted-foreground">Project Canvas is free for every Constructed Matter client and prospect. Create an account or log in, and start sketching your next project today.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                Create an account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/client/login" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:border-accent/50">
                Log in
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Not a client yet? Creating an account is the fastest way to get a conversation going.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
