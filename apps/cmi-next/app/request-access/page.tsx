"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";

const FIELD =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";

export default function RequestAccessPage() {
  const [form, setForm] = React.useState({ name: "", email: "", company: "", message: "" });
  const [status, setStatus] = React.useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send your request.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <AuthLayout>
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="h-5 w-5 text-accent" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Request sent</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Thanks — the Constructed Matter team has your request and will reach out if access is approved.
        </p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Request access</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The dashboard is invite-only. Tell us who you are and we&apos;ll be in touch.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">Full Name <span className="text-accent">*</span></label>
          <input id="name" type="text" required value={form.name} onChange={(e) => set("name", e.target.value)} className={FIELD} placeholder="Jane Smith" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email <span className="text-accent">*</span></label>
          <input id="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className={FIELD} placeholder="you@company.com" />
        </div>
        <div>
          <label htmlFor="company" className="mb-1.5 block text-sm font-medium">Company / Role</label>
          <input id="company" type="text" value={form.company} onChange={(e) => set("company", e.target.value)} className={FIELD} placeholder="Constructed Matter — Project Manager" />
        </div>
        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm font-medium">Anything else?</label>
          <textarea id="message" rows={3} value={form.message} onChange={(e) => set("message", e.target.value)} className={`${FIELD} resize-none`} placeholder="Why you need access, who referred you, etc." />
        </div>

        {status === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={status === "loading"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
        >
          {status === "loading" ? "Sending…" : (<>Send request <ArrowRight className="h-4 w-4" /></>)}
        </button>
      </form>

      <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </AuthLayout>
  );
}
