"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, CloudUpload, Loader2, Paperclip, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  SECTIONS, isVisible, missingRequired, progressOf, visibleFields,
  type Answers, type Field,
} from "@/lib/prequal/form";

const STORAGE_KEY = "cmi-prequal-token";

type Saved = "idle" | "saving" | "saved" | "error";

/**
 * The public prequalification application.
 *
 * Drafts live server-side against a token kept in localStorage, so closing the
 * tab doesn't lose the work and the link can be mailed on to whoever actually
 * has the insurance certificates.
 */
export function ApplicationClient() {
  const [token, setToken] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<Answers>({});
  const [step, setStep] = React.useState(0);
  const [saved, setSaved] = React.useState<Saved>("idle");
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [booting, setBooting] = React.useState(true);

  // Resume the draft if there is one, otherwise open a new application.
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      let existing: string | null = null;
      try { existing = window.localStorage.getItem(STORAGE_KEY); } catch { /* private window */ }

      if (existing) {
        const res = await fetch(`/api/prequal/${existing}`);
        if (res.ok) {
          const json = await res.json();
          if (!alive) return;
          setToken(existing);
          setAnswers(json.answers ?? {});
          if (json.status !== "draft") setSubmitted(true);
          setBooting(false);
          return;
        }
      }

      const res = await fetch("/api/prequal/start", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!alive) return;
      if (res.ok) {
        setToken(json.token);
        try { window.localStorage.setItem(STORAGE_KEY, json.token); } catch { /* fine */ }
      } else {
        setError(json.error ?? "Couldn't start the application.");
      }
      setBooting(false);
    })();
    return () => { alive = false; };
  }, []);

  // Autosave, debounced, so a long form survives a closed laptop.
  const dirty = React.useRef(false);
  React.useEffect(() => {
    if (!token || !dirty.current || submitted) return;
    const t = setTimeout(async () => {
      setSaved("saving");
      const res = await fetch(`/api/prequal/${token}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, step: SECTIONS[step]?.key }),
      });
      setSaved(res.ok ? "saved" : "error");
      dirty.current = false;
    }, 900);
    return () => clearTimeout(t);
  }, [answers, token, step, submitted]);

  const set = React.useCallback((key: string, value: unknown) => {
    dirty.current = true;
    setSaved("idle");
    setAnswers((a) => ({ ...a, [key]: value }));
  }, []);

  const progress = progressOf(answers);
  const section = SECTIONS[step];
  const fields = section ? visibleFields(section, answers) : [];
  const missing = missingRequired(answers);

  async function saveNow() {
    if (!token) return;
    setSaved("saving");
    const res = await fetch(`/api/prequal/${token}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, step: section?.key }),
    });
    setSaved(res.ok ? "saved" : "error");
    dirty.current = false;
  }

  async function submit() {
    if (!token) return;
    await saveNow();
    setError(null);
    const res = await fetch(`/api/prequal/${token}/submit`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Couldn't submit."); return; }
    setSubmitted(true);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* fine */ }
  }

  if (booting) {
    return <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening your application…</p>;
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <Check className="h-6 w-6 text-accent" />
        </div>
        <h2 className="font-display text-2xl font-semibold">Application Received</h2>
        <p className="leading-relaxed text-muted-foreground">
          Thank you. Our team reviews every prequalification application and will be in touch. If anything is
          missing or we need a current certificate, we&apos;ll email the contact you gave us.
        </p>
        <a href="mailto:info@constructedmatter.com" className="mt-2 text-sm font-medium text-accent hover:underline">
          Questions? Email us &rarr;
        </a>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Progress + jump between sections */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {step + 1} of {SECTIONS.length} &middot; {progress}% complete</span>
          <SaveState state={saved} />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <nav aria-label="Application sections" className="mt-3 flex flex-wrap gap-1.5">
          {SECTIONS.map((s, i) => {
            // A tick means "you've put something here", not "this is complete":
            // almost nothing is required, so completeness ticks would show up
            // on every untouched section.
            const started = visibleFields(s, answers)
              .some((f) => f.type !== "content" && filled(answers[f.key]));
            return (
              <button
                key={s.key} type="button" onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition",
                  i === step
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
                )}
              >
                {started && i !== step && <Check className="h-3 w-3 text-accent" />}
                {s.title}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Current section */}
      <div className="min-w-0">
        <div className="rounded-2xl border border-border bg-card p-8">
          <h2 className="font-display text-2xl font-semibold">{section?.title}</h2>
          {section?.description && <p className="mt-2 leading-relaxed text-muted-foreground">{section.description}</p>}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {fields.map((field) => (
              <FieldInput
                key={field.key} field={field} value={answers[field.key]}
                token={token} onChange={(v) => set(field.key, v)}
              />
            ))}
          </div>

          {error && <p role="alert" className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void saveNow()}>
                <Save className="h-4 w-4" /> Save and finish later
              </Button>
              {step < SECTIONS.length - 1 ? (
                <Button variant="accent" onClick={() => setStep((s) => Math.min(SECTIONS.length - 1, s + 1))}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="accent" disabled={missing.length > 0} onClick={() => void submit()}>
                  <Check className="h-4 w-4" /> Submit application
                </Button>
              )}
            </div>
          </div>

          {step === SECTIONS.length - 1 && missing.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              <p className="font-medium">Still needed before you can submit:</p>
              <ul className="mt-1 list-disc pl-4">
                {missing.slice(0, 8).map((m, i) => (
                  <li key={i}>{m.field.label} <span className="text-muted-foreground">({m.section})</span></li>
                ))}
                {missing.length > 8 && <li>and {missing.length - 8} more</li>}
              </ul>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your answers save automatically. You can close this page and come back on the same browser.
        </p>
      </div>
    </div>
  );
}

const filled = (v: unknown) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

function SaveState({ state }: { state: Saved }) {
  if (state === "saving") return <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving</span>;
  if (state === "saved") return <span className="flex items-center gap-1 text-accent"><Check className="h-3 w-3" /> Saved</span>;
  if (state === "error") return <span className="text-destructive">Not saved</span>;
  return null;
}

function FieldInput({
  field, value, token, onChange,
}: {
  field: Field; value: unknown; token: string | null; onChange: (v: unknown) => void;
}) {
  const wide = field.type === "textarea" || field.type === "multiselect" || field.type === "content" || field.type === "document";

  if (field.type === "content") {
    return (
      <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground sm:col-span-2">
        {field.body}
      </p>
    );
  }

  return (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="mb-1.5 block text-sm font-medium">
        {field.label}{field.required && <span className="text-accent"> *</span>}
      </span>
      {field.help && <span className="mb-1.5 block text-xs text-muted-foreground">{field.help}</span>}

      {field.type === "textarea" ? (
        <Textarea
          className="min-h-[88px]" placeholder={field.placeholder}
          value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "yesno" ? (
        <div className="flex gap-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt} type="button" onClick={() => onChange(opt === "Yes")}
              className={cn("rounded-md border px-3 py-1.5 text-sm transition",
                (value === true && opt === "Yes") || (value === false && opt === "No")
                  ? "border-accent bg-accent/10 font-medium" : "border-border hover:bg-muted")}
            >{opt}</button>
          ))}
        </div>
      ) : field.type === "select" ? (
        <Select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      ) : field.type === "multiselect" ? (
        <div className="flex flex-wrap gap-1.5">
          {field.options?.map((o) => {
            const list = Array.isArray(value) ? (value as string[]) : [];
            const on = list.includes(o);
            return (
              <button
                key={o} type="button"
                onClick={() => onChange(on ? list.filter((v) => v !== o) : [...list, o])}
                className={cn("rounded-full border px-2.5 py-1 text-xs transition",
                  on ? "border-accent bg-accent/10 font-medium" : "border-border hover:bg-muted")}
              >{on && <Check className="mr-1 inline h-3 w-3" />}{o}</button>
            );
          })}
        </div>
      ) : field.type === "document" ? (
        <DocumentInput field={field} value={value} token={token} onChange={onChange} />
      ) : (
        <Input
          type={field.type === "number" || field.type === "currency" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "url" ? "url" : "text"}
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function DocumentInput({
  field, value, token, onChange,
}: {
  field: Field; value: unknown; token: string | null; onChange: (v: unknown) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const current = value as { name?: string; path?: string } | undefined;

  async function upload(file: File) {
    if (!token) return;
    setBusy(true); setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("doc_type", field.docType ?? "other");
    const res = await fetch(`/api/prequal/${token}/upload`, { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Upload failed."); return; }
    onChange({ name: json.name, path: json.path, size: json.size, doc_type: json.doc_type });
  }

  return (
    <div className="rounded-md border border-dashed border-border p-3">
      {current?.name ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="truncate">{current.name}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-destructive">Replace</button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
          <span>{busy ? "Uploading…" : "Choose a PDF or photo"}</span>
          <input
            type="file" className="sr-only" accept=".pdf,image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
