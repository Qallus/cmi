"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";

type Stage = "loading" | "form" | "saving" | "error";

const FIELD =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";

export default function ClientResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>("loading");
  const [notice, setNotice] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    const hash = window.location.hash.slice(1);
    const token = new URLSearchParams(hash).get("access_token");
    if (!token) {
      setNotice("This reset link is invalid or missing its token. Request a new one.");
      setStage("error");
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
        setStage("form");
      })
      .catch((e) => {
        setNotice(e instanceof Error ? e.message : "This reset link is invalid or has expired.");
        setStage("error");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    if (password.length < 8) {
      setNotice("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setNotice("Passwords do not match.");
      return;
    }
    setStage("saving");
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
      setNotice(err instanceof Error ? err.message : "Could not update your password.");
      setStage("form");
    }
  }

  return (
    <AuthLayout variant="client">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Set a new password for your project portal.</p>
      </div>

      {stage === "loading" && (
        <div className="space-y-3">
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {stage === "error" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            {notice}
          </div>
          <Link href="/client/forgot-password" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            Request a new reset link <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {(stage === "form" || stage === "saving") && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">New Password</label>
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${FIELD} pr-10`} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">Confirm Password</label>
            <input id="confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} placeholder="Re-enter your password" />
          </div>

          {notice && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              {notice}
            </div>
          )}

          <button type="submit" disabled={stage === "saving"} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
            {stage === "saving" ? "Saving…" : (<>Update password <ArrowRight className="h-4 w-4" /></>)}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
