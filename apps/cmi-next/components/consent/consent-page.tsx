"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

type Channel = "sms" | "email";
type Mode = "opt_in" | "opt_out";

const BUSINESS = "Constructed Matter, Inc.";
const ADDRESS = "7314 E Osborn Dr, Suite A · Scottsdale, AZ 85251";
const SUPPORT_PHONE = "(480) 906-4400";

export function ConsentPageView({ channel, mode }: { channel: Channel; mode: Mode }) {
  const [address, setAddress] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");

  const isSms = channel === "sms";
  const isIn = mode === "opt_in";
  const title = `${isSms ? "SMS" : "Email"} ${isIn ? "Opt‑In" : "Opt‑Out"}`;
  const placeholder = isSms ? "(480) 555‑0100" : "you@example.com";
  const inputType = isSms ? "tel" : "email";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, action: mode, address }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1c14", color: "#f5f3ee", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 520, background: "#13241a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.6 }}>{BUSINESS}</div>
        <h1 style={{ margin: "8px 0 4px", fontSize: 26 }}>{title}</h1>

        {done ? (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#c8a35b", fontWeight: 700 }}>
              <Check size={18} /> {isIn ? "You're subscribed." : "You've been unsubscribed."}
            </div>
            <p style={{ marginTop: 10, fontSize: 14, opacity: 0.8 }}>
              {isIn
                ? `Thanks — your ${isSms ? "phone number" : "email"} is now opted in to receive ${isSms ? "text messages" : "emails"} from ${BUSINESS}.`
                : `Your ${isSms ? "phone number" : "email"} has been removed. You will no longer receive ${isSms ? "text messages" : "marketing emails"} from ${BUSINESS}.`}
            </p>
          </div>
        ) : (
          <>
            <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, opacity: 0.85 }}>
              {isIn
                ? `Enter your ${isSms ? "mobile number" : "email address"} to receive ${isSms ? "appointment reminders, quote and project updates, and service notifications" : "updates, quotes, and notifications"} from ${BUSINESS}.`
                : `Enter your ${isSms ? "mobile number" : "email address"} to stop receiving ${isSms ? "text messages" : "marketing emails"} from ${BUSINESS}.`}
            </p>

            <form onSubmit={submit} style={{ marginTop: 16 }}>
              <input
                type={inputType}
                required
                aria-label={isSms ? "Phone number" : "Email address"}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={placeholder}
                style={{ width: "100%", height: 46, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "#0f1c14", color: "#f5f3ee", padding: "0 14px", fontSize: 15, boxSizing: "border-box" }}
              />
              {error && <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 13 }}>{error}</div>}
              <button
                type="submit"
                disabled={busy}
                style={{ marginTop: 12, width: "100%", height: 46, borderRadius: 10, border: "none", background: "#c8a35b", color: "#0f1c14", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                {isIn ? `Opt in to ${isSms ? "SMS" : "Email"}` : `Opt out of ${isSms ? "SMS" : "Email"}`}
              </button>
            </form>
          </>
        )}

        {/* Compliance disclosure */}
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 12, lineHeight: 1.7, opacity: 0.7 }}>
          {isSms ? (
            <p>
              By opting in, you agree to receive recurring automated text messages (appointment reminders, quotes, and project/service updates) from {BUSINESS} at the number provided. Consent is not a condition of purchase. Message frequency varies. <strong>Message &amp; data rates may apply.</strong> Reply <strong>STOP</strong> to unsubscribe or <strong>HELP</strong> for help, or call {SUPPORT_PHONE}.
            </p>
          ) : (
            <p>
              By opting in, you agree to receive emails (updates, quotes, and notifications) from {BUSINESS}. You can unsubscribe at any time using the link in any email or this page. {BUSINESS}, {ADDRESS}.
            </p>
          )}
          <p style={{ marginTop: 8 }}>
            See our <a href="/privacy" style={{ color: "#c8a35b" }}>Privacy Policy</a> and <a href="/terms" style={{ color: "#c8a35b" }}>Terms</a>. {ADDRESS}.
          </p>
        </div>
      </div>
    </div>
  );
}
