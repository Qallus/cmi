"use client";

import * as React from "react";
import { Headphones, Mail, Phone, Sparkles, X } from "lucide-react";
import { BoltVoiceModal } from "./bolt-voice-modal";

export function ContactFab() {
  const [open, setOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-[80]">
      {open && (
        <div className="absolute bottom-16 right-0 w-[280px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl sm:w-[320px]">
          <div className="border-b border-border p-4">
            <div className="text-sm font-semibold">Constructed Matter Support</div>
            <div className="mt-1 text-xs text-muted-foreground">We are open Monday - Friday 8:00 am to 5:00 pm.</div>
          </div>
          <div className="divide-y divide-border">
            <a href="tel:+14806284458" className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <Phone className="h-4 w-4 text-accent" strokeWidth={1.6} />
              (480) 628-4458
            </a>
            <a href="mailto:info@constructedmatter.com" className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <Mail className="h-4 w-4 text-accent" strokeWidth={1.6} />
              info@constructedmatter.com
            </a>
            <button
              type="button"
              onClick={() => { setVoiceOpen(true); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.6} />
              Talk to Bolt AI
            </button>
          </div>
        </div>
      )}

      {voiceOpen && <BoltVoiceModal onClose={() => setVoiceOpen(false)} />}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs shadow-lg">
          <span className="font-semibold text-foreground">Need Help?</span>
          <button type="button" onClick={() => setOpen(true)} className="font-semibold text-accent transition hover:text-accent/80">
            Contact us
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-xl transition hover:bg-foreground/90"
          aria-label={open ? "Close contact options" : "Open contact options"}
        >
          {open ? <X className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
