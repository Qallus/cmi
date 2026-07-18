"use client";

import * as React from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "unsupported" | "default" | "denied" | "subscribed" | "loading";

export function PushToggle({ className, endpoint = "/api/push/subscribe" }: { className?: string; endpoint?: string }) {
  const [state, setState] = React.useState<State>("loading");

  const supported = React.useCallback(() => {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(VAPID_PUBLIC_KEY);
  }, []);

  React.useEffect(() => {
    if (!supported()) { setState("unsupported"); return; }
    (async () => {
      if (Notification.permission === "denied") { setState("denied"); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "subscribed" : "default");
      } catch {
        setState("default");
      }
    })();
  }, [supported]);

  async function enable() {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "default"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setState(res.ok ? "subscribed" : "default");
    } catch {
      setState("default");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("default");
    } catch {
      setState("subscribed");
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-xs", className)}>
      {state === "denied" ? (
        <span className="flex items-center gap-2 text-muted-foreground"><BellOff className="h-3.5 w-3.5" /> Notifications blocked in browser settings</span>
      ) : state === "subscribed" ? (
        <>
          <span className="flex items-center gap-2 font-medium text-success"><Bell className="h-3.5 w-3.5" /> Push notifications on</span>
          <button type="button" onClick={() => void disable()} className="font-medium text-muted-foreground hover:text-foreground hover:underline">Turn off</button>
        </>
      ) : state === "loading" ? (
        <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…</span>
      ) : (
        <button type="button" onClick={() => void enable()} className="flex items-center gap-2 font-medium text-accent hover:underline">
          <Bell className="h-3.5 w-3.5" /> Enable push notifications
        </button>
      )}
    </div>
  );
}
