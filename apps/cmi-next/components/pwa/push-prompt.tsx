"use client";

import * as React from "react";
import { Bell, X } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const DISMISS_KEY = "cmi-push-prompt-dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "hidden" | "offer" | "working";

/**
 * A one-time ask to turn on push notifications.
 *
 * A push subscription can only be created by the browser, on the device, after
 * the person grants permission — there is no way to enrol someone from the
 * server. The enable button existed, but only inside the bell's dropdown,
 * where nobody found it: one person in the company had ever subscribed. This
 * asks once, in the open, and never again once answered or dismissed.
 */
export function PushPrompt() {
  const [state, setState] = React.useState<State>("hidden");

  React.useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window
      && "Notification" in window && Boolean(VAPID_PUBLIC_KEY);
    if (!supported) return;
    // Already answered, either way: permission is granted/denied, or dismissed.
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch { /* private mode: asking once more is harmless */ }

    let live = true;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (live && !sub) setState("offer"); })
      .catch(() => { if (live) setState("offer"); });
    return () => { live = false; };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* fine */ }
    setState("hidden");
  }

  async function enable() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { dismiss(); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch { /* fall through: the toggle on My Profile is still there */ }
    dismiss();
  }

  if (state === "hidden") return null;

  return (
    <div className="flex items-center gap-3 border-b border-accent/25 bg-accent/10 px-5 py-2.5 text-sm print:hidden">
      <Bell className="h-4 w-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Turn on notifications</span>
        <span className="text-muted-foreground"> — get told when someone messages you or assigns you work, even when this tab is closed.</span>
      </p>
      <button
        type="button"
        onClick={() => void enable()}
        disabled={state === "working"}
        className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {state === "working" ? "Working…" : "Turn on"}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
