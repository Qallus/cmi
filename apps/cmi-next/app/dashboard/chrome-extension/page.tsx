import { Download } from "lucide-react";
import { EXTENSION_RELEASE } from "@/lib/extension/release";
import { CopyText } from "./copy-text";

export const metadata = { title: "Chrome Extension — CMI Dashboard" };

// Install guide for the Selection Card Builder: download, unzip, load it in
// Chrome. Once it's in, the panel uses the dashboard sign-in in that Chrome
// profile, so there is no separate sign-in.
export default function ChromeExtensionPage() {
  const r = EXTENSION_RELEASE;
  const step = "flex gap-3";
  const num = "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent";
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Selections</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Chrome Extension</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The CMI Selection Card Builder captures a product from any vendor website (title, photo, price, specs) and saves it as a
          Selection Card, to the library or straight onto a job.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <div className="font-medium">CMI Selection Card Builder</div>
          <div className="text-xs text-muted-foreground">Version {r.version} · updated {new Date(`${r.updated}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · for Google Chrome on a computer</div>
        </div>
        <a href={r.href} download className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90">
          <Download className="h-4 w-4" /> Download
        </a>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Install it (about 2 minutes)</h2>
        <ol className="space-y-4 text-sm">
          <li className={step}><span className={num}>1</span><div><b>Download</b> the file above.</div></li>
          <li className={step}><span className={num}>2</span><div>
            <b>Unzip it.</b> Open your Downloads folder, right-click <i>cmi-selection-card-builder.zip</i> → <b>Extract All</b> (on a Mac, double-click it).
            Move the <b>{r.folder}</b> folder somewhere it can stay, such as Documents. Chrome runs the extension from that folder, so don&apos;t delete it.
          </div></li>
          <li className={step}><span className={num}>3</span><div className="min-w-0">
            <b>Open Chrome&apos;s extensions page.</b> Paste this into Chrome&apos;s address bar and press Enter:
            <div className="mt-2"><CopyText text="chrome://extensions" /></div>
          </div></li>
          <li className={step}><span className={num}>4</span><div>Turn on <b>Developer mode</b> (the switch at the top right of that page).</div></li>
          <li className={step}><span className={num}>5</span><div>Click <b>Load unpacked</b> and choose the <b>{r.folder}</b> folder (the one that contains <i>manifest.json</i>).</div></li>
          <li className={step}><span className={num}>6</span><div><b>Pin it:</b> click the puzzle-piece icon next to Chrome&apos;s address bar, then the pin beside <b>CMI Selection Card Builder</b>.</div></li>
        </ol>
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm">
        <h2 className="font-semibold">Use it</h2>
        <p>Open a product page on any vendor&apos;s site and click the CMI icon. The panel opens beside the page and fills in what it finds; check the fields, choose the Selection Library or a job, and save.</p>
        <p className="text-muted-foreground">It uses your CMI dashboard sign-in. Stay signed in to the dashboard in the same Chrome profile and there&apos;s nothing else to sign in to.</p>
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm">
        <h2 className="font-semibold">Updating</h2>
        <p>When a new version is posted here, download it, unzip it, and replace the files in your <b>{r.folder}</b> folder with the new ones. Then on <i>chrome://extensions</i> click the reload arrow (↻) on the extension.</p>
        <p className="text-muted-foreground">Chrome may show a note about developer-mode extensions when it starts. That&apos;s expected for this version; you can close it.</p>
      </section>
    </div>
  );
}
