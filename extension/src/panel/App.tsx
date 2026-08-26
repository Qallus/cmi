import { useCallback, useEffect, useState } from "react";
import { EMPTY_DRAFT, type CardDraft, type Destination, type SessionInfo } from "../types";
import { api, ApiError } from "./api";
import { clearToken, getToken, onTokenChange, openSignIn } from "./auth";
import { API_BASE, EXTENSION_VERSION } from "./config";
import { autoBuild, startPick, CaptureError } from "./capture";
import type { Confidence } from "../content/injected";
import { CardForm } from "./components/CardForm";
import { DestinationPicker } from "./components/DestinationPicker";
import { CardModal, SelectionCard } from "./components/SelectionCard";

type Phase = "loading" | "signed-out" | "disabled" | "ready" | "error";

// Which page-captured field maps onto which draft key.
const PICK_TO_DRAFT: Record<string, keyof CardDraft> = {
  title: "title",
  vendor_name: "vendor_name",
  category: "category",
  price: "price",
  sku: "sku",
  model_number: "model_number",
  short_description: "short_description",
  long_description: "long_description",
  image_url: "image_url",
};

function useTheme() {
  const [dark, setDark] = useState<boolean>(() =>
    typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)").matches : false,
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function App() {
  const { dark, toggle } = useTheme();
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [draft, setDraft] = useState<CardDraft>(EMPTY_DRAFT);
  const [destination, setDestination] = useState<Destination>({ kind: "library", group: null });
  const [showModal, setShowModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  // Phase 2 capture state
  const [confidence, setConfidence] = useState<Record<string, Confidence>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [captureMsg, setCaptureMsg] = useState("");

  // Receive picked values from the injected element picker.
  useEffect(() => {
    const listener = (msg: { type?: string; field?: string; value?: string }) => {
      if (msg?.type === "CMI_PICK" && msg.field) {
        const key = PICK_TO_DRAFT[msg.field] ?? (msg.field as keyof CardDraft);
        setDraft((d) => ({ ...d, [key]: msg.value ?? "" }));
        setConfidence((c) => ({ ...c, [msg.field as string]: "high" }));
        setPicking(null);
      } else if (msg?.type === "CMI_PICK_CANCEL") {
        setPicking(null);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function runAutoBuild() {
    setBuilding(true);
    setCaptureMsg("");
    setSaveError("");
    try {
      const { fields, confidence: conf } = await autoBuild();
      setDraft((d) => {
        const next = { ...d };
        for (const [k, v] of Object.entries(fields)) {
          const key = PICK_TO_DRAFT[k] ?? (k as keyof CardDraft);
          if (v && key in next) (next as Record<string, unknown>)[key as string] = v;
        }
        return next;
      });
      setConfidence((c) => ({ ...c, ...conf }));
      const n = Object.keys(fields).filter((k) => k !== "source_url").length;
      setCaptureMsg(n ? `Auto-filled ${n} field${n === 1 ? "" : "s"} — review and edit as needed.` : "No product data found on this page.");
    } catch (e) {
      setCaptureMsg(e instanceof CaptureError ? e.message : "Auto-Build failed on this page.");
    } finally {
      setBuilding(false);
    }
  }

  async function onPick(field: string) {
    setPicking(field);
    setCaptureMsg("");
    try {
      await startPick(field);
    } catch (e) {
      setPicking(null);
      setCaptureMsg(e instanceof CaptureError ? e.message : "Couldn't start the picker on this page.");
    }
  }

  const check = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setPhase("signed-out");
      return;
    }
    try {
      const s = (await api.session()) as SessionInfo;
      setSession(s);
      setPhase("ready");
    } catch (e) {
      if (e instanceof ApiError && e.code === "EXTENSION_ACCESS_DISABLED") {
        setPhase("disabled");
      } else if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        setPhase("signed-out");
      } else {
        setErrorMsg(e instanceof Error ? e.message : "Something went wrong.");
        setPhase("error");
      }
    }
  }, []);

  useEffect(() => {
    void check();
    return onTokenChange(() => void check());
  }, [check]);

  async function save() {
    if (!draft.title.trim()) {
      setSaveError("A product title is required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      // Re-host external images so the card doesn't break when vendor URLs expire.
      let imageUrl = draft.image_url.trim();
      if (imageUrl && /^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith(API_BASE)) {
        try {
          const ing = await api.ingestImage(imageUrl);
          imageUrl = ing.url;
        } catch {
          /* keep the original URL if ingest fails */
        }
      }

      const job = destination.kind === "job" ? destination.job : null;
      const payload = {
        title: draft.title,
        eyebrow: draft.eyebrow,
        vendor_name: draft.vendor_name,
        category: draft.category,
        sku: draft.sku,
        model_number: draft.model_number,
        price: draft.price,
        price_unit: draft.price_unit,
        short_description: draft.short_description,
        long_description: draft.long_description,
        features: draft.features.split(/\r?\n/).map((f) => f.trim()).filter(Boolean),
        image_url: imageUrl,
        source_url: draft.source_url,
        staff_notes: draft.staff_notes,
        visible_to_client: draft.visible_to_client,
        visible_to_contractor: draft.visible_to_contractor,
        visible_to_vendor: draft.visible_to_vendor,
        job_id: job?.id ?? null,
        selection_group_id: destination.group?.id ?? null,
        capture_method: "manual",
        extension_version: EXTENSION_VERSION,
      };
      const res = await api.createCard(payload);
      setSavedUrl(res.dashboard_url);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save the card.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(EMPTY_DRAFT);
    setDestination({ kind: "library", group: null });
    setSavedUrl(null);
    setSaveError("");
    setConfidence({});
    setCaptureMsg("");
    setPicking(null);
  }

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <Header dark={dark} onToggleTheme={toggle} session={session} onSignOut={async () => { await clearToken(); setSession(null); setPhase("signed-out"); }} />

      <div style={{ flex: 1, padding: 14 }}>
        {phase === "loading" && <Muted>Loading…</Muted>}

        {phase === "signed-out" && (
          <Centered
            title="Sign in to CMI"
            body="Connect your CMI dashboard session to start capturing selection cards."
            actionLabel="Sign in"
            onAction={openSignIn}
          />
        )}

        {phase === "disabled" && (
          <Centered
            title="Extension access is off"
            body="Your account doesn't have Selection Card Builder access yet. Ask a CMI admin to enable it in Settings → Extension Access."
            actionLabel="Re-check"
            onAction={() => void check()}
          />
        )}

        {phase === "error" && (
          <Centered title="Something went wrong" body={errorMsg} actionLabel="Retry" onAction={() => void check()} />
        )}

        {phase === "ready" &&
          (savedUrl ? (
            <Centered
              title="Card saved"
              body="Your selection card is in the CMI dashboard."
              actionLabel="Capture another"
              onAction={reset}
              secondary={
                <a href={savedUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
                  Open in CMI Dashboard →
                </a>
              }
            />
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <Section title="Capture">
                <button
                  type="button"
                  onClick={() => void runAutoBuild()}
                  disabled={building}
                  style={{
                    width: "100%",
                    background: "var(--accent)",
                    color: "var(--accent-fg)",
                    border: "none",
                    borderRadius: 10,
                    padding: "11px 14px",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: building ? "default" : "pointer",
                    opacity: building ? 0.7 : 1,
                  }}
                >
                  {building ? "Reading page…" : "⚡ Auto-Build from this page"}
                </button>
                <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
                  Or click the <strong style={{ color: "var(--accent)" }}>⌖</strong> on any field below, then click that item on the page.
                </p>
                {captureMsg && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg)" }}>{captureMsg}</p>}
                {picking && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--accent)" }}>
                    Picking <strong>{picking.replace(/_/g, " ")}</strong>… click it on the page (Esc to cancel).
                  </p>
                )}
              </Section>

              <Section title="Preview">
                <SelectionCard draft={draft} />
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  style={{ marginTop: 8, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: 0 }}
                >
                  Expand preview
                </button>
              </Section>

              <Section title="Destination">
                <DestinationPicker destination={destination} onChange={setDestination} />
              </Section>

              <Section title="Details">
                <CardForm
                  draft={draft}
                  onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
                  onPick={onPick}
                  picking={picking}
                  confidence={confidence}
                />
              </Section>

              <Section title="Visibility">
                <div style={{ display: "grid", gap: 8 }}>
                  <Toggle label="Visible to client" checked={draft.visible_to_client} onChange={(v) => setDraft((d) => ({ ...d, visible_to_client: v }))} />
                  <Toggle label="Visible to contractor" checked={draft.visible_to_contractor} onChange={(v) => setDraft((d) => ({ ...d, visible_to_contractor: v }))} />
                  <Toggle label="Visible to vendor" checked={draft.visible_to_vendor} onChange={(v) => setDraft((d) => ({ ...d, visible_to_vendor: v }))} />
                </div>
              </Section>

              {saveError && <div style={{ color: "var(--danger)", fontSize: 12.5 }}>{saveError}</div>}

              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-fg)",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : "Save Selection Card"}
              </button>
            </div>
          ))}
      </div>

      {showModal && <CardModal draft={draft} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function Header({
  dark,
  onToggleTheme,
  session,
  onSignOut,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  session: SessionInfo | null;
  onSignOut: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderBottom: "1px solid var(--border)",
        background: "var(--card)",
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>CMI Selections</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {session && (
          <span style={{ fontSize: 11, color: "var(--muted)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.staff.name}
          </span>
        )}
        <button type="button" onClick={onToggleTheme} title="Toggle theme" style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", cursor: "pointer", color: "var(--fg)", fontSize: 12 }}>
          {dark ? "☾" : "☀"}
        </button>
        {session && (
          <button type="button" onClick={onSignOut} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11 }}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>{title}</div>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          position: "relative",
          width: 40,
          height: 22,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: checked ? "var(--accent)" : "var(--border)",
          transition: "background 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      </button>
    </label>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "var(--muted)", fontSize: 13, padding: 8 }}>{children}</div>;
}

function Centered({
  title,
  body,
  actionLabel,
  onAction,
  secondary,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  secondary?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "40px 16px" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, margin: 0 }}>{title}</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.55, margin: 0, maxWidth: 260 }}>{body}</p>
      <button
        type="button"
        onClick={onAction}
        style={{ background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
      >
        {actionLabel}
      </button>
      {secondary}
    </div>
  );
}
