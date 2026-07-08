"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Supabase invite/magic links deliver the access token in the URL hash fragment.
// We exchange it for a client session, then let the client set a password.
export default function ClientSetAccountPage() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<"verifying" | "set" | "error">("verifying");
  const [firstName, setFirstName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const token = new URLSearchParams(hash.replace(/^#/, "")).get("access_token");
    if (!token) { setError("This link is missing its access token. Request a new invite."); setPhase("error"); return; }
    fetch("/api/client/auth/exchange-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token }) })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setFirstName(j.first_name ?? ""); setPhase("set"); })
      .catch((e) => { setError(e instanceof Error ? e.message : "Invalid or expired link."); setPhase("error"); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/client/auth/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      router.push("/client/jobs");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not set password."); setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/brand/cmi-logo-dark.png" alt="Constructed Matter, Inc." className="mx-auto h-10 object-contain dark:hidden" />
          <img src="/brand/cmi-logo-light.png" alt="Constructed Matter, Inc." className="mx-auto hidden h-10 object-contain dark:block" />
          <h1 className="mt-4 font-display text-xl font-semibold">Set Up Your Account</h1>
        </div>
        {phase === "verifying" && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Verifying your invite…</div>}
        {phase === "error" && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-destructive">{error}</div>}
        {phase === "set" && (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-6">
            {firstName && <p className="text-sm text-muted-foreground">Welcome, {firstName}. Choose a password to finish.</p>}
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex flex-col gap-1"><label className="text-xs font-medium text-muted-foreground">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" /></div>
            <div className="flex flex-col gap-1"><label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" /></div>
            <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? "Saving…" : "Set Password & Continue"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
