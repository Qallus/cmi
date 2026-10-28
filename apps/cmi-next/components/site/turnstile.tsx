"use client";

// Cloudflare Turnstile widget. The site key comes from the server page at run
// time (TURNSTILE_SITE_KEY), so no build variable is needed; renders nothing
// without one (and the server skips verification without its secret).
import * as React from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SRC}"]`) as HTMLScriptElement | null;
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile")));
    if (!existing) { s.src = SRC; s.async = true; s.defer = true; document.head.appendChild(s); }
  });
}

export function Turnstile({ siteKey, onToken }: { siteKey?: string | null; onToken: (token: string | null) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!siteKey || !ref.current) return;
    let id: string | null = null;
    let alive = true;
    loadScript().then(() => {
      if (!alive || !ref.current || !window.turnstile) return;
      id = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }).catch(() => onToken(null));
    return () => { alive = false; if (id && window.turnstile) window.turnstile.remove(id); };
  }, [siteKey, onToken]);
  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}
