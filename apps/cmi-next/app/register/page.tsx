"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";

type Stage = "loading" | "form" | "saving" | "done" | "error";

const FIELD =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  project_manager: "Project Manager",
  staff: "Staff",
  designer: "Designer",
  estimator: "Estimator",
  superintendent: "Superintendent",
  subcontractor: "Subcontractor",
  vendor: "Vendor",
  client: "Client",
  viewer: "Viewer",
};

export default function RegisterPage() {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>("loading");
  const [notice, setNotice] = React.useState("");
  const [role, setRole] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [form, setForm] = React.useState({ first_name: "", last_name: "", password: "", confirm_password: "" });

  React.useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    if (!accessToken) {
      setNotice("No invite token found in the link. Please use the link from your invite email, or contact your administrator.");
      setStage("error");
      return;
    }
    fetch("/api/auth/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setNotice(data.error ?? "Invalid or expired invite link.");
          setStage("error");
          return;
        }
        setRole(data.role ?? "viewer");
        setForm((f) => ({ ...f, first_name: data.first_name ?? "", last_name: data.last_name ?? "" }));
        setStage("form");
      })
      .catch(() => {
        setNotice("Network error. Please try again.");
        setStage("error");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setNotice("First and last name are required.");
      return;
    }
    if (form.password.length < 8) {
      setNotice("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirm_password) {
      setNotice("Passwords do not match.");
      return;
    }
    setStage("saving");
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "Failed to save profile.");
        setStage("form");
        return;
      }
      setStage("done");
      router.push("/dashboard/overview");
    } catch {
      setNotice("Network error. Please try again.");
      setStage("form");
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Set up your account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Confirm your name and create a password to finish setting up your Constructed Matter dashboard access.
        </p>
        {role && (
          <div className="mt-3 inline-block rounded-md bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            {ROLE_LABELS[role] ?? role}
          </div>
        )}
      </div>

      {stage === "loading" && (
        <div className="space-y-3">
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {stage === "error" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            {notice}
          </div>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            Go to sign in instead <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {(stage === "form" || stage === "saving") && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="first_name" className="mb-1.5 block text-sm font-medium">First Name</label>
              <input id="first_name" type="text" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={FIELD} />
            </div>
            <div>
              <label htmlFor="last_name" className="mb-1.5 block text-sm font-medium">Last Name</label>
              <input id="last_name" type="text" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={FIELD} />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Create Password</label>
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${FIELD} pr-10`} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium">Confirm Password</label>
            <div className="relative">
              <input id="confirm_password" type={showConfirm ? "text" : "password"} required autoComplete="new-password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} className={`${FIELD} pr-10`} placeholder="Re-enter your password" />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showConfirm ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {notice && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              {notice}
            </div>
          )}

          <button type="submit" disabled={stage === "saving"} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
            {stage === "saving" ? "Saving…" : (<>Complete Setup <ArrowRight className="h-4 w-4" /></>)}
          </button>
        </form>
      )}

      {stage === "done" && (
        <div className="rounded-lg bg-accent/10 px-4 py-3 text-center text-sm text-accent">
          Account set up. Redirecting to your dashboard…
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">This portal is for Constructed Matter staff only.</p>
    </AuthLayout>
  );
}
