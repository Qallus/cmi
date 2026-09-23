"use client";

import * as React from "react";

// Whether the floating Quick Actions button is shown.
//
// It sits over the bottom-right corner, which is exactly where the last row of
// a long list ends up, so it has to be dismissable. Stored per browser like the
// theme and the mobile nav's dismissed state — it's a layout preference, not
// account data.
const STORAGE_KEY = "cmi-fab-hidden";
const EVENT = "cmi-fab-preference";

export function isFabHidden(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private browsing, or storage blocked — show it, which is the default.
    return false;
  }
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
    return () => {
      window.removeEventListener(EVENT, onCustom);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return [hidden, setFabHidden];
}
