"use client";

// The MSA step of the application: read the current Master Subcontractor
// Agreement, consent to sign electronically, draw a signature, and confirm
// with a code emailed to the signer. The server records the evidence and
// builds the signed PDF (lib/prequal/msa.ts).
import * as React from "react";
import { Check, ExternalLink, Loader2, Mail, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignaturePad } from "@/components/ui/signature-pad";
import type { Answers } from "@/lib/prequal/form";

type State = {
  msa: { id: string; label: string; url: string | null } | null;
  signature: { signer_name: string; signer_title: string | null; signed_at: string | null; version_matches: boolean } | null;
  consent_text: string;
};

export function MsaStep({ token, answers, onSigned }: { token: string | null; answers: Answers; onSigned: (v: unknown) => void }) {
  const [state, setState] = React.useState<State | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const fullName = [answers.contact_first_name, answers.contact_last_name].filter(Boolean).join(" ");
  const [name, setName] = React.useState(fullName);
  const [title, setTitle] = React.useState(String(answers.contact_title ?? ""));
  const [email, setEmail] = React.useState(String(answers.contact_email ?? ""));
  const [consent, setConsent] = React.useState(false);
  const [signature, setSignature] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [codeSent, setCodeSent] = React.useState<null | { held: boolean }>(null);
  const [busy, setBusy] = React.useState<"code" | "sign" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) return;
    const res = await fetch(`/api/prequal/${token}/msa`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setLoadError(json.error ?? "Couldn't load the agreement."); return; }
    setState(json as State);
  }, [token]);
  React.useEffect(() => { void load(); }, [load]);

  async function post(path: string, body: unknown) {
    const res = await fetch(`/api/prequal/${token}/msa/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
    return json;
  }

  async function sendCode() {
    setBusy("code"); setError(null);
    try {
      const json = await post("code", { name, title, email });
      setCodeSent({ held: !!json.held });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function sign() {
    setBusy("sign"); setError(null);
    try {
      const json = await post("sign", { code, consent, signature });
      onSigned({ signed: true, signer_name: name, signed_at: json.signed_at, version: state?.msa?.label });
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  if (loadError) return <p className="text-sm text-destructive sm:col-span-2">{loadError}</p>;
  if (!state) return <p className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading the agreement…</p>;

  if (!state.msa) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground sm:col-span-2">
        Our Master Subcontractor Agreement isn&apos;t available online yet. We&apos;ll send it to you for signature after we review your application.
      </div>
    );
  }

  const signed = state.signature && state.signature.version_matches;
  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
        <div>
          <p className="text-sm font-medium">Master Subcontractor Agreement · {state.msa.label}</p>
          <p className="text-xs text-muted-foreground">Please read the full agreement before signing.</p>
        </div>
        {state.msa.url && (
          <a href={state.msa.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            Read the agreement (PDF) <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {signed ? (
        <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>
            Signed by <span className="font-medium">{state.signature!.signer_name}</span>
            {state.signature!.signer_title ? `, ${state.signature!.signer_title}` : ""} on{" "}
            {new Date(state.signature!.signed_at!).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.
            We&apos;ll email you a copy when you submit.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Full name <span className="text-accent">*</span></span>
              <Input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Title</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Email <span className="text-accent">*</span></span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          </div>

          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><PenLine className="h-4 w-4" /> Your signature <span className="text-accent">*</span></span>
            <SignaturePad onChange={setSignature} />
          </div>

          <label className="flex items-start gap-2.5 text-sm leading-relaxed">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{state.consent_text}</span>
          </label>

          <div className="rounded-xl border border-border p-4">
            <p className="text-sm">To confirm it&apos;s you, we&apos;ll email a 6-digit code to <span className="font-medium">{email || "your email"}</span>.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" disabled={!name.trim() || !email.trim() || busy !== null} onClick={() => void sendCode()}>
                {busy === "code" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} {codeSent ? "Send a new code" : "Email me a code"}
              </Button>
              {codeSent && (
                <>
                  <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-36" />
                  <Button type="button" variant="accent" disabled={code.length !== 6 || !consent || !signature || busy !== null} onClick={() => void sign()}>
                    {busy === "sign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Sign agreement
                  </Button>
                </>
              )}
            </div>
            {codeSent && <p className="mt-2 text-xs text-muted-foreground">{codeSent.held ? "Test mode: the code was written to the server log instead of emailed." : "Code sent. It expires in 15 minutes. Check spam if you don't see it."}</p>}
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
