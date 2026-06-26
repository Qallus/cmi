"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard/overview";

  // Forward magic link tokens that land on /login to /register
  React.useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    if (params.get("access_token")) {
      router.replace(`/register#${hash}`);
    }
  }, [router]);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Sign in failed. Please try again.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          placeholder="you@constructedmatter.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 pr-10 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <img
            src="/brand/cmi-favicon-black.png"
            alt="Constructed Matter, Inc."
            className="h-14 w-14 object-contain dark:hidden"
          />
          <img
            src="/brand/cmi-favicon-white.png"
            alt="Constructed Matter, Inc."
            className="hidden h-14 w-14 object-contain dark:block"
          />
          <h1 className="text-xl font-semibold">Staff Dashboard</h1>
          <p className="text-center text-sm text-muted-foreground">
            Sign in with your staff account to continue.
          </p>
        </div>

        <React.Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
          <LoginForm />
        </React.Suspense>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This portal is for Constructed Matter staff only.
        </p>
      </div>
    </div>
  );
}
