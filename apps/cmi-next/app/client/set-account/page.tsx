"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";

const FIELD =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";

// Supabase invite/magic links deliver the access token in the URL hash fragment.
// We exchange it for a client session, then let the client set a password.
export default function ClientSetAccountPage() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<"verifying" | "set" | "error">("verifying");
  const [firstName, setFirstName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const token = new URLSearchParams(hash.replace(/^#/, "")).get("access_token");
    if (!token) {
      setError("This link is missing its access token. Request a new invite.");
      setPhase("error");
      return;
    }
    fetch("/api/client/auth/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setFirstName(j.first_name ?? "");
        setPhase("set");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Invalid or expired link.");
        setPhase("error");
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push("/client/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout variant="client">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Set up your account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {firstName ? `Welcome, ${firstName}. ` : ""}Choose a password to access your project portal.
        </p>
      </div>

      {phase === "verifying" && (
        <div className="space-y-3">
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {phase === "set" && (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${FIELD} pr-10`} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">Confirm Password</label>
            <input id="confirm" type={showPassword ? "text" : "password"} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} placeholder="Re-enter your password" />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
            {busy ? "Saving…" : (<>Set Password &amp; Continue <ArrowRight className="h-4 w-4" /></>)}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
