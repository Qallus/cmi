"use client";

import * as React from "react";
import { Apple, Download, MonitorDown, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Shared install-prompt state ─────────────────────────────────────────────
// The browser fires `beforeinstallprompt` once. We capture it in a module-level
// singleton so every InstallAppButton on the page (hero, footer, …) shares the
// same deferred prompt and stays in sync after it's used or the app installs.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let didInstall = false;
let initialized = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

function initInstallListeners() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    didInstall = true;
    deferredPrompt = null;
    notify();
  });
}

function useInstallPrompt() {
  initInstallListeners();
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    subscribers.add(force);
    return () => { subscribers.delete(force); };
  }, []);

  const promptInstall = React.useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    const event = deferredPrompt;
    try {
      await event.prompt();
      const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      return choice.outcome;
    } finally {
      deferredPrompt = null;
      notify();
    }
  }, []);

  return { canPrompt: Boolean(deferredPrompt), installed: didInstall, promptInstall };
}

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

// ── The button ──────────────────────────────────────────────────────────────
export function InstallAppButton({
  variant = "accent",
  size = "default",
  className,
  fullWidth,
  label = "Download the CMI App",
}: {
  variant?: "default" | "accent" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  fullWidth?: boolean;
  label?: string;
}) {
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [platform, setPlatform] = React.useState<Platform>("desktop");
  const [standalone, setStandalone] = React.useState(false);

  React.useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandalone());
  }, []);

  // Already running as an installed app — nothing to download.
  if (standalone || installed) return null;

  async function onClick() {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome === "unavailable") setHelpOpen(true);
      return;
    }
    // iOS Safari (no prompt API) and any browser that hasn't offered a prompt:
    // show step-by-step Add-to-Home-Screen / install instructions.
    setHelpOpen(true);
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} className={cn(fullWidth && "w-full", className)} onClick={() => void onClick()}>
        <Download className="h-4 w-4" />
        {label}
      </Button>
      {helpOpen ? <InstallHelpModal platform={platform} onClose={() => setHelpOpen(false)} /> : null}
    </>
  );
}

function InstallHelpModal({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const steps: { icon: React.ComponentType<{ className?: string }>; text: string }[] =
    platform === "ios"
      ? [
          { icon: Share, text: "Tap the Share button in Safari's toolbar (the square with an up arrow)." },
          { icon: SquarePlus, text: "Choose “Add to Home Screen.”" },
          { icon: Download, text: "Tap “Add” — the CMI app appears on your home screen." },
        ]
      : platform === "android"
        ? [
            { icon: MonitorDown, text: "Open the browser menu (⋮) in the top-right." },
            { icon: SquarePlus, text: "Tap “Install app” or “Add to Home screen.”" },
            { icon: Download, text: "Confirm — the CMI app installs to your device." },
          ]
        : [
            { icon: MonitorDown, text: "Click the install icon in your browser's address bar (or menu → “Install”)." },
            { icon: SquarePlus, text: "Choose “Install Constructed Matter.”" },
            { icon: Download, text: "The app opens in its own window and is added to your apps." },
          ];

  const title = platform === "ios" ? "Add CMI to your iPhone or iPad" : platform === "android" ? "Install the CMI app" : "Install the CMI desktop app";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            {platform === "ios" ? <Apple className="h-5 w-5 text-accent" /> : <MonitorDown className="h-5 w-5 text-accent" />}
            <h2 className="font-display text-lg font-semibold">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="space-y-3 px-5 py-5">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={index} className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="pt-1 text-sm leading-6">{step.text}</span>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Installing adds Constructed Matter as an app with its own icon — no app store needed.
        </div>
      </div>
    </div>
  );
}
