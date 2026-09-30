"use client";

import * as React from "react";
import { Bell, Mail, Megaphone } from "lucide-react";
import { PushToggle } from "@/components/pwa/push-toggle";

/**
 * A staff member's own notification switches.
 *
 * This replaces a lone Announcements toggle. Push enrolment used to live only
 * inside the bell's dropdown, where nobody found it — one person in the whole
 * company had ever subscribed — so it is surfaced here next to the switches it
 * belongs with.
 *
 * Saving is optimistic and reverts on failure: these are cheap, reversible
 * preferences and a spinner on each one would be worse than the rare undo.
 */
type Prefs = { broadcasts_enabled: boolean; email_enabled: boolean; push_enabled: boolean };

const ROWS: { key: keyof Prefs; icon: typeof Mail; label: string; hint: string }[] = [
  {
    key: "email_enabled",
    icon: Mail,
    label: "Email",
    hint: "Get an email when something is assigned to you or someone messages you directly.",
  },
  {
    key: "push_enabled",
    icon: Bell,
    label: "Push notifications",
    hint: "Alerts on this device, even when the dashboard is closed. Enable them below first.",
  },
  {
    key: "broadcasts_enabled",
    icon: Megaphone,
    label: "Announcements",
    hint: "Company-wide messages from the Constructed Matter team.",
  },
];

export function NotificationSettings({ endpoint = "/api/me/notification-prefs" }: { endpoint?: string }) {
  const [prefs, setPrefs] = React.useState<Prefs | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    fetch(endpoint)
      .then((r) => r.json())
      .then((d: Partial<Prefs>) => {
        if (!live) return;
        setPrefs({
          broadcasts_enabled: d.broadcasts_enabled ?? true,
          email_enabled: d.email_enabled ?? true,
          push_enabled: d.push_enabled ?? true,
        });
      })
      .catch(() => {
        if (live) setPrefs({ broadcasts_enabled: true, email_enabled: true, push_enabled: true });
      });
    return () => { live = false; };
  }, [endpoint]);

  async function toggle(key: keyof Prefs, value: boolean) {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setPrefs(previous);
      setError("That did not save. Try again.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Notifications</h2>
        <p className="text-xs text-muted-foreground">
          How you hear about messages, assignments and announcements. These are yours alone.
        </p>
      </div>

      <ul className="divide-y divide-border">
        {ROWS.map(({ key, icon: Icon, label, hint }) => {
          const on = prefs?.[key] ?? true;
          return (
            <li key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Toggle ${label}`}
                disabled={prefs === null}
                onClick={() => void toggle(key, !on)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-accent" : "bg-muted"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="border-t border-border px-4 py-2 text-xs text-destructive">{error}</p>
      )}

      {/* Browser enrolment is separate from the preference: the switch above
          says whether to send, this says whether this device can receive. */}
      <div className="border-t border-border bg-muted/20">
        <PushToggle />
      </div>
    </div>
  );
}
