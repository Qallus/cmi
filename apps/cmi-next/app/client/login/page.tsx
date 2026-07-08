"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/client/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Sign in failed.");
      const redirectTo = new URLSearchParams(window.location.search).get("redirectTo");
      router.push(redirectTo || "/client/jobs");
    } catch (err) { setError(err instanceof Error ? err.message : "Sign in failed."); setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/brand/cmi-logo-dark.png" alt="Constructed Matter, Inc." className="mx-auto h-10 object-contain dark:hidden" />
          <img src="/brand/cmi-logo-light.png" alt="Constructed Matter, Inc." className="mx-auto hidden h-10 object-contain dark:block" />
          <h1 className="mt-4 font-display text-xl font-semibold">Project Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to view your project.</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-6">
          {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
          </div>
          <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">Trouble signing in? Contact your Constructed Matter project manager.</p>
      </div>
    </div>
  );
}
