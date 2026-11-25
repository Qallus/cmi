"use client";

// The public invitation page (and the builder's live preview). Layout follows
// the 2026 Christmas invite: animated hero, message, RSVP, good to know, who's
// coming. Styling is inline and self-contained so it looks the same inside the
// dashboard preview as on the public page.
import * as React from "react";
import { cmiHero } from "@/lib/events/hero-script";
import { themeById } from "@/lib/events/themes";
import { formatDay, formatWhen, mapUrl, splitLocation, splitTitle } from "@/lib/events/format";
import type { EventDesign } from "@/lib/events/design";
import type { PublicGuests, PublicRsvp } from "@/lib/events/types";
import { Turnstile } from "@/components/site/turnstile";
import { CustomDesignFrame } from "./custom-design-frame";

export type InvitationView = {
  slug: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  rsvp_deadline: string | null;
  allow_plus_one: boolean;
  access: "invite_only" | "link";
  design: EventDesign;
  design_mode?: "theme" | "custom";
  custom_html?: string | null;
};

const FONT = "'Poppins', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const INK = "#1b1b1b";
const MUTED = "#8a8a8a";
const LINE = "#e3e1dd";
const PAGE = "#f2f1ee";

// Faint glyphs over the hero (a hexagon and an asterisk-flake, like the CMI mark).
function patternUrl(color: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><g fill='none' stroke='${color}' stroke-width='1.2'><path d='M22 10l9 5v10l-9 5-9-5V15z'/><path d='M67 47v18M59 51l16 10M59 61l16-10'/><circle cx='67' cy='16' r='1.6'/><path d='M22 58v14M16 61l12 8M16 69l12-8'/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function HeroCanvas({ kind, colors }: { kind: string; colors: string[] }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const key = colors.join(",");
  React.useEffect(() => {
    if (!ref.current) return;
    return cmiHero(ref.current, kind, key.split(","));
  }, [kind, key]);
  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: "26px 28px", marginTop: 18 }}>{children}</section>;
}

function CardTitle({ dot, children, sub }: { dot: string; children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0, fontSize: 19, fontWeight: 500, letterSpacing: "0.01em", color: INK }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: dot, display: "inline-block" }} />
        {children}
      </h2>
      {sub ? <p style={{ margin: "6px 0 0", fontSize: 13, color: MUTED }}>{sub}</p> : null}
    </div>
  );
}

function Choice({ on, onClick, children, color, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; color: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      style={{
        flex: 1, minHeight: 50, borderRadius: 2, fontFamily: FONT, fontSize: 15, cursor: disabled ? "default" : "pointer",
        border: `1px solid ${on ? color : LINE}`, background: on ? color : "#fff", color: on ? "#fff" : INK, fontWeight: on ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 500, color: INK, margin: "18px 0 8px" };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 2, padding: "12px 14px", fontSize: 15, fontFamily: FONT, color: INK, background: "#fff" };

function linkify(text: string) {
  // Emails and phone numbers in short notes become links.
  const parts = text.split(/([\w.+-]+@[\w-]+\.[\w.-]+|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g);
  return parts.map((p, i) => {
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(p)) return <a key={i} href={`mailto:${p}`} style={{ color: "inherit" }}>{p}</a>;
    if (/^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(p)) return <a key={i} href={`tel:${p.replace(/\D/g, "")}`} style={{ color: "inherit" }}>{p}</a>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

export function InvitationPage({
  event,
  guests: initialGuests,
  rsvp: initialRsvp,
  closed = false,
  preview = false,
  turnstileSiteKey = null,
}: {
  event: InvitationView;
  guests: PublicGuests;
  rsvp: PublicRsvp | null;
  closed?: boolean;
  preview?: boolean;
  turnstileSiteKey?: string | null;
}) {
  const d = event.design;
  const theme = themeById(d.theme);
  const custom = event.design_mode === "custom" && !!event.custom_html;
  const title = splitTitle(event.title, d.title_accent);
  const where = splitLocation(event.location);
  const map = mapUrl(event.location);

  const [rsvp, setRsvp] = React.useState<PublicRsvp | null>(initialRsvp);
  const [liveGuests, setGuests] = React.useState(initialGuests);
  // The builder preview follows the guest list it's given.
  const guests = preview ? initialGuests : liveGuests;
  const [status, setStatus] = React.useState<"attending" | "declined" | null>(initialRsvp?.status === "invited" ? null : (initialRsvp?.status as "attending" | "declined" | undefined) ?? null);
  const [plusOne, setPlusOne] = React.useState<boolean>(initialRsvp?.plus_one ?? false);
  const [plusOneName, setPlusOneName] = React.useState(initialRsvp?.plus_one_name ?? "");
  const [notes, setNotes] = React.useState(initialRsvp?.notes ?? "");
  const [name, setName] = React.useState(initialRsvp?.name ?? "");
  const [email, setEmail] = React.useState(initialRsvp?.email ?? "");
  const [trap, setTrap] = React.useState("");
  const [turnstile, setTurnstile] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const startedAt = React.useRef(0);
  React.useEffect(() => { startedAt.current = Date.now(); }, []);
  const storeKey = `cmi-rsvp:${event.slug}`;


  // A returning open-link guest: pick their RSVP back up from this browser.
  React.useEffect(() => {
    if (preview || rsvp) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(storeKey); } catch { /* storage blocked */ }
    if (!saved) return;
    fetch(`/api/rsvp/${event.slug}?i=${saved}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.rsvp) return;
        const r = j.rsvp as PublicRsvp;
        setRsvp(r); setName(r.name ?? ""); setEmail(r.email ?? "");
        if (r.status !== "invited") setStatus(r.status as "attending" | "declined");
        setPlusOne(r.plus_one); setPlusOneName(r.plus_one_name ?? ""); setNotes(r.notes ?? "");
        if (j.guests) setGuests(j.guests);
      })
      .catch(() => {});
  }, [preview, rsvp, storeKey, event.slug]);

  const personal = !!rsvp?.token;
  const needIdentity = !personal;
  const locked = !personal && event.access === "invite_only";
  const responded = !!rsvp && rsvp.status !== "invited";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (preview) { setMsg({ ok: true, text: "Preview only: RSVPs aren't saved here." }); return; }
    if (!status) { setMsg({ ok: false, text: "Choose whether you'll be there." }); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/rsvp/${event.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: rsvp?.token ?? null, name, email, status, plus_one: plusOne, plus_one_name: plusOneName, notes,
          company_website: trap, startedAt: startedAt.current, turnstile,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Something went wrong. Please try again." }); return; }
      if (j.rsvp?.token) {
        setRsvp(j.rsvp);
        try { localStorage.setItem(storeKey, j.rsvp.token); } catch { /* storage blocked */ }
        try {
          const u = new URL(window.location.href);
          if (u.searchParams.get("i") !== j.rsvp.token) { u.searchParams.set("i", j.rsvp.token); window.history.replaceState(null, "", u.toString()); }
        } catch { /* ignore */ }
      }
      if (j.guests) setGuests(j.guests);
      setMsg({ ok: true, text: "Saved. Thanks!" });
    } catch {
      setMsg({ ok: false, text: "Couldn't reach the server. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const facts: [string, React.ReactNode][] = [];
  const when = formatWhen(event.start_time, event.end_time);
  if (when) facts.push(["When", when]);
  if (where.venue) {
    const whereNode = (
      <span>
        {where.venue}
        {where.address ? (<><br />{map ? <a href={map} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecorationThickness: 1, textUnderlineOffset: 3 }}>{where.address}</a> : where.address}</>) : null}
      </span>
    );
    facts.push(["Where", whereNode]);
  }
  if (event.rsvp_deadline) facts.push(["RSVP by", formatDay(event.rsvp_deadline)]);

  return (
    <div style={{ fontFamily: FONT, background: PAGE, color: INK, minHeight: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" precedence="default" />

      {custom ? (
        <CustomDesignFrame html={event.custom_html ?? ""} title={event.title} />
      ) : (
        <>
      <header style={{ position: "relative", overflow: "hidden", background: theme.heroBg, color: theme.heroInk }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: patternUrl(theme.pattern), backgroundSize: "90px 90px" }} />
        <HeroCanvas kind={theme.animation} colors={[theme.accent, ...theme.stripe]} />
        <div style={{ position: "relative", maxWidth: 560, margin: "0 auto", padding: "40px 20px 44px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cmi_line_logo_white.png" alt="Constructed Matter, Inc." style={{ height: 30, width: "auto", display: "block" }} />
          {d.eyebrow ? <p style={{ margin: "36px 0 0", fontSize: 11.5, letterSpacing: "0.28em", textTransform: "uppercase", color: theme.heroMuted, fontWeight: 500 }}>{d.eyebrow}</p> : <div style={{ height: 30 }} />}
          <h1 style={{ margin: "14px 0 0", fontSize: "clamp(28px, 6vw, 40px)", lineHeight: 1.15, fontWeight: 600 }}>
            {title.before}
            {title.accent ? <span style={{ color: theme.accent }}>{title.accent}</span> : null}
            {title.after}
          </h1>
          {facts.length ? (
            <dl style={{ margin: "26px 0 0", display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 22, rowGap: 12, fontSize: 15.5 }}>
              {facts.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", paddingTop: 4 }}>{k}</dt>
                  <dd style={{ margin: 0, fontWeight: 500 }}>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : null}
        </div>
      </header>
      <div aria-hidden style={{ display: "flex", height: 5 }}>
        {theme.stripe.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
      </div>

        </>
      )}

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 40px" }}>
        {!custom && (d.message_heading || d.message_body || d.signoff || d.image_url) ? (
          <section style={{ background: "#fff", border: `1px solid ${LINE}`, borderTop: "none", borderRadius: "0 0 4px 4px", padding: "26px 28px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
            {d.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.image_url} alt="" style={{ width: "100%", height: "auto", borderRadius: 2, marginBottom: 18, display: "block" }} />
            ) : null}
            {d.message_heading ? <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>{d.message_heading}</h2> : null}
            {d.message_body ? <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, whiteSpace: "pre-line" }}>{d.message_body}</p> : null}
            {d.signoff ? <p style={{ margin: "18px 0 0", fontSize: 16, lineHeight: 1.6, fontStyle: "italic", color: "#4a4a4a", whiteSpace: "pre-line" }}>{d.signoff}</p> : null}
          </section>
        ) : null}

        <Card>
          <CardTitle dot={theme.accent} sub={closed ? "RSVPs are closed." : "You can come back and change it anytime."}>Your RSVP</CardTitle>
          {d.rsvp_note ? (
            <div style={{ background: "#f2f1ee", borderLeft: `3px solid ${theme.stripe[1]}`, padding: "12px 16px", fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
              {linkify(d.rsvp_note)}
            </div>
          ) : null}

          {locked && !preview ? (
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
              This invitation is personal. Please open the RSVP link from your invite email or text.
            </p>
          ) : (
            <form onSubmit={submit} noValidate>
              <input type="text" name="company_website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
              {needIdentity ? (
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 14 }}>
                  <input style={inputStyle} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Your name" disabled={closed} />
                  <input style={inputStyle} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Email" disabled={closed} />
                </div>
              ) : rsvp?.name ? (
                <p style={{ margin: "0 0 14px", fontSize: 14, color: MUTED }}>RSVP for <strong style={{ color: INK, fontWeight: 500 }}>{rsvp.name}</strong></p>
              ) : null}

              <div style={{ display: "flex", gap: 8 }}>
                <Choice on={status === "attending"} onClick={() => setStatus("attending")} color={theme.choice} disabled={closed}>I&apos;ll be there</Choice>
                <Choice on={status === "declined"} onClick={() => { setStatus("declined"); setPlusOne(false); }} color={theme.choice} disabled={closed}>Can&apos;t make it</Choice>
              </div>

              {status === "attending" && event.allow_plus_one ? (
                <>
                  <label style={labelStyle}>Bringing a +1?</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Choice on={plusOne} onClick={() => setPlusOne(true)} color="#1b1b1b" disabled={closed}>Yes, +1</Choice>
                    <Choice on={!plusOne} onClick={() => setPlusOne(false)} color="#1b1b1b" disabled={closed}>Just me</Choice>
                  </div>
                  {plusOne ? (
                    <>
                      <label style={labelStyle}>+1&apos;s name <span style={{ color: MUTED, fontWeight: 400 }}>optional</span></label>
                      <input style={inputStyle} value={plusOneName} onChange={(e) => setPlusOneName(e.target.value)} disabled={closed} />
                    </>
                  ) : null}
                </>
              ) : null}

              {status === "attending" && d.dietary ? (
                <>
                  <label style={labelStyle}>Dietary needs or notes <span style={{ color: MUTED, fontWeight: 400 }}>optional</span></label>
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="Anything we should tell the restaurant" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={closed} />
                </>
              ) : null}

              {needIdentity && !preview && turnstileSiteKey ? <div style={{ marginTop: 14 }}><Turnstile siteKey={turnstileSiteKey} onToken={setTurnstile} /></div> : null}

              {!closed ? (
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22, flexWrap: "wrap" }}>
                  <button type="submit" disabled={busy} style={{ background: theme.accent, color: "#fff", border: "none", borderRadius: 2, padding: "14px 22px", fontFamily: FONT, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
                    {busy ? "Saving…" : responded ? "Update RSVP" : "Send RSVP"}
                  </button>
                  {msg ? <span role="status" style={{ fontSize: 14, color: msg.ok ? MUTED : "#b42318" }}>{msg.text}</span> : null}
                </div>
              ) : null}
              {!preview && responded && rsvp?.status === "attending" ? (
                <p style={{ margin: "14px 0 0", fontSize: 13 }}>
                  <a href={`/api/rsvp/${event.slug}/ics${rsvp.token ? `?i=${rsvp.token}` : ""}`} style={{ color: MUTED }}>Add to calendar</a>
                </p>
              ) : null}
            </form>
          )}
        </Card>

        {d.good_to_know.length ? (
          <Card>
            <CardTitle dot={theme.accent}>Good to know</CardTitle>
            <dl style={{ display: "grid", gridTemplateColumns: "minmax(90px, auto) 1fr", columnGap: 22, rowGap: 14, margin: 0, fontSize: 15, lineHeight: 1.55 }}>
              {d.good_to_know.map((row, i) => (
                <React.Fragment key={i}>
                  <dt style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, paddingTop: 3 }}>{row.label}</dt>
                  <dd style={{ margin: 0 }}>
                    {row.url ? <a href={row.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{row.value || row.url}</a> : linkify(row.value)}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </Card>
        ) : null}

        {d.guest_list !== "off" ? (
          <Card>
            <CardTitle dot={theme.accent} sub={`${guests.count} coming so far`}>Who&apos;s coming</CardTitle>
            {guests.names.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", rowGap: 10, columnGap: 20, fontSize: 15.5 }}>
                {guests.names.map((g, i) => (
                  <li key={i}>{g.name}{g.plus_one ? <span style={{ color: MUTED, marginLeft: 6 }}>+1</span> : null}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}

        <footer style={{ textAlign: "center", marginTop: 48 }}>
          {d.footer_note ? <p style={{ margin: 0, fontSize: 16 }}>{d.footer_note}</p> : null}
          <p style={{ margin: "8px 0 0", fontSize: 13, color: MUTED }}>Constructed Matter, Inc. &nbsp;|&nbsp; 7314 E Osborn Dr, Suite A, Scottsdale, AZ 85251</p>
        </footer>
      </main>
    </div>
  );
}
