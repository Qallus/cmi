"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Chrome, LogIn, Loader2 } from "lucide-react";

type ChromeLike = {
  runtime?: {
    sendMessage?: (id: string, msg: unknown, cb?: (resp: unknown) => void) => void;
    lastError?: { message?: string };
  };
};

type State = "sending" | "sent" | "error" | "no-extension" | "signed-out";

export function ExtensionAuthHandoff({
  token,
  staffName,
  extensionId,
}: {
  token: string | null;
  staffName: string | null;
  extensionId: string;
}) {
  const [state, setState] = React.useState<State>(token ? "sending" : "signed-out");
  const [detail, setDetail] = React.useState("");

  const send = React.useCallback(() => {
    if (!token) {
      setState("signed-out");
      return;
    }
    const chrome = (window as unknown as { chrome?: ChromeLike }).chrome;
    if (!extensionId || !chrome?.runtime?.sendMessage) {
      setState("no-extension");
      return;
    }
    setState("sending");
    try {
      chrome.runtime.sendMessage(extensionId, { type: "CMI_AUTH", token, staffName }, () => {
        const err = chrome.runtime?.lastError;
        if (err) {
          setState("error");
          setDetail(err.message ?? "Could not reach the extension.");
          return;
        }
        setState("sent");
      });
    } catch (e) {
      setState("error");
      setDetail(e instanceof Error ? e.message : "Failed to send the session to the extension.");
    }
  }, [token, staffName, extensionId]);

  React.useEffect(() => {
    // Intentional one-time handoff on mount: push the session to the extension.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) send();
  }, [token, send]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-16 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
          <Chrome className="h-5 w-5 text-accent" />
          CMI Selection Card Builder
        </div>

        {state === "sending" && (
          <Panel
            icon={<Loader2 className="h-6 w-6 animate-spin text-accent" />}
            title="Connecting…"
            body="Sending your session to the extension."
          />
        )}

        {state === "sent" && (
          <Panel
            icon={<CheckCircle2 className="h-6 w-6 text-accent" />}
            title="Connected"
            body={`You're signed in${staffName ? ` as ${staffName}` : ""}. You can close this tab and return to the extension's side panel.`}
          />
        )}

        {state === "signed-out" && (
          <Panel
            icon={<LogIn className="h-6 w-6 text-accent" />}
            title="Sign in to continue"
            body="Sign in to your CMI dashboard, then this page will hand your session to the extension."
            action={
              <a
                href="/login?next=/extension-auth"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
              >
                <LogIn className="h-4 w-4" /> Sign in
              </a>
            }
          />
        )}

        {state === "no-extension" && (
          <Panel
            icon={<AlertTriangle className="h-6 w-6 text-amber-500" />}
            title="Extension not detected"
            body="Open this page from the extension's “Sign in” button, and make sure the CMI Selection Card Builder is installed and enabled."
            action={
              <button
                type="button"
                onClick={send}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold transition hover:border-accent/40"
              >
                Try again
              </button>
            }
          />
        )}

        {state === "error" && (
          <Panel
            icon={<AlertTriangle className="h-6 w-6 text-destructive" />}
            title="Couldn't connect"
            body={detail || "Something went wrong handing your session to the extension."}
            action={
              <button
                type="button"
                onClick={send}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold transition hover:border-accent/40"
              >
                Try again
              </button>
            }
          />
        )}
      </div>
    </main>
  );
}

function Panel({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">{icon}</div>
      <h1 className="font-display text-xl font-semibold">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
