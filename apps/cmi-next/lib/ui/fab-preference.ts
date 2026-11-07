"use client";

import * as React from "react";

// Whether the floating Quick Actions button is shown.
//
// It sits over the bottom-right corner, which is exactly where the last row of
// a long list ends up, so it has to be dismissable. Stored per browser like the
// theme and the mobile nav's dismissed state — it's a layout preference, not
// account data. Until someone picks Show or Hide, it starts hidden on phones and
// tablets (under 1024px, where the footer bar already gives quick actions) and
// shown on desktop.
const STORAGE_KEY = "cmi-fab-hidden";
const EVENT = "cmi-fab-preference";

const SMALL_SCREEN = "(max-width: 1023px)";

export function isFabHidden(): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing, or storage blocked — fall back to the default below.
  }
  if (stored === "1") return true;
  if (stored === "0") return false;
  return window.matchMedia(SMALL_SCREEN).matches;
}

export function setFabHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    // Not persisting is survivable; the event below still updates this tab.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: hidden }));
}

/**
 * Live preference for components that need to react to it — the button itself
 * and the Settings toggle stay in step without a page reload.
 *
 * Starts as `false` on the server and on the first client render so the markup
 * matches; the stored value lands right after mount.
 */
export function useFabHidden(): [boolean, (hidden: boolean) => void] {
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setHidden(isFabHidden());
    sync();
    const onCustom = (e: Event) => setHidden(Boolean((e as CustomEvent).detail));
    window.addEventListener(EVENT, onCustom);
    // Another tab changing it.
    window.addEventListener("storage", sync);
    // The default follows the screen size (e.g. a tablet rotated), until a choice is saved.
    const mq = window.matchMedia(SMALL_SCREEN);
    mq.addEventListener("change", sync);
    return () => {
      window.removeEventListener(EVENT, onCustom);
      window.removeEventListener("storage", sync);
      mq.removeEventListener("change", sync);
    };
  }, []);

  return [hidden, setFabHidden];
}
