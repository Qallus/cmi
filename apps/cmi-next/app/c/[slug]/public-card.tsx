"use client";

import * as React from "react";
import { Copy, Heart, Moon, Share2, Sun, UserPlus, X } from "lucide-react";
import { CardPreview } from "@/components/business-card/card-preview";
import type { BusinessCard, BusinessCardLink, EventType, LeadFormField } from "@/lib/business-cards/types";

export function PublicCard({ card, publicUrl }: { card: BusinessCard; publicUrl: string }) {
  const links = (card.business_card_links ?? []).slice().sort((a, b) => a.display_order - b.display_order);
  const sections = card.business_card_sections ?? [];
  const opener = sections.find((s) => s.section_type === "opener" && s.is_visible);

  const [showSplash, setShowSplash] = React.useState(Boolean(opener));
  const [light, setLight] = React.useState(false);
  const [leadOpen, setLeadOpen] = React.useState(false);
  const [liked, setLiked] = React.useState(false);

  const canToggle = card.theme_mode === "both";
  const effectiveCard = light
    ? { ...card, background_color: "#f5f3ee", text_color: "#13201a", accent_color: card.accent_color }
    : card;

  const track = React.useCallback((eventType: EventType, linkId?: string) => {
    navigator.sendBeacon?.(
      "/api/cards/events",
      new Blob([JSON.stringify({ cardId: card.id, eventType, linkId })], { type: "application/json" }),
    ) ||
      fetch("/api/cards/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, eventType, linkId }),
        keepalive: true,
      }).catch(() => {});
  }, [card.id]);

  function handleAction(action: "call" | "sms" | "email" | "map" | "lead" | "website" | "video") {
    switch (action) {
      case "call": if (card.primary_phone) { track("link_click"); window.location.href = `tel:${card.primary_phone}`; } break;
      case "sms": { const n = card.sms_phone || card.primary_phone; if (n) { track("link_click"); window.location.href = `sms:${n}`; } break; }
      case "email": if (card.primary_email) { track("link_click"); window.location.href = `mailto:${card.primary_email}`; } break;
      case "map": if (card.maps_url) { track("link_click"); window.open(card.maps_url, "_blank"); } break;
      case "website": if (card.website_url) { track("link_click"); window.open(card.website_url, "_blank"); } break;
      case "video": if (card.intro_video_url) { track("link_click"); window.open(card.intro_video_url, "_blank"); } break;
      case "lead": setLeadOpen(true); break;
    }
  }

  function handleLink(link: BusinessCardLink) {
    track("link_click", link.id);
    if (link.url) window.open(link.url, link.open_in_new_tab ? "_blank" : "_self");
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); track("copy_link"); } catch { /* ignore */ }
  }
  async function share() {
    track("share");
    if (navigator.share) { try { await navigator.share({ title: "Digital business card", url: publicUrl }); } catch { /* cancelled */ } }
    else copyLink();
  }
  function save() { track("save_contact"); window.location.href = `/api/cards/vcf?slug=${encodeURIComponent(card.slug)}`; }
  function like() { if (!liked) { setLiked(true); track("like"); } }

  const bg = effectiveCard.background_color;

  return (
    <div className="min-h-screen w-full px-4 py-8" style={{ background: bg }}>
      {showSplash && opener && (
        <Splash
          content={(opener.content || {}) as Record<string, unknown>}
          card={card}
          onView={() => setShowSplash(false)}
        />
      )}

      <div className="mx-auto max-w-sm">
        {canToggle && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setLight((v) => !v)} className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(127,127,127,0.15)", color: effectiveCard.text_color }} aria-label="Toggle theme">
              {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        )}

        <CardPreview
          card={effectiveCard}
          links={links}
          sections={sections}
          publicUrl={publicUrl}
          onAction={handleAction}
          onLink={handleLink}
        />

        {/* Action bar */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <FabBtn icon={<Copy className="h-4 w-4" />} label="Copy" onClick={copyLink} accent={card.accent_color} />
          <FabBtn icon={<Share2 className="h-4 w-4" />} label="Share" onClick={share} accent={card.accent_color} />
          <FabBtn icon={<UserPlus className="h-4 w-4" />} label="Save" onClick={save} accent={card.accent_color} />
          <FabBtn icon={<Heart className={liked ? "h-4 w-4 fill-current" : "h-4 w-4"} />} label="Like" onClick={like} accent={card.accent_color} />
        </div>
      </div>

      {leadOpen && (
        <LeadModal card={card} onClose={() => setLeadOpen(false)} onSubmitted={() => track("lead_submit")} />
      )}
    </div>
  );
}

function FabBtn({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium" style={{ background: "rgba(127,127,127,0.15)", color: accent }}>
      {icon}{label}
    </button>
  );
}

function youtubeId(url: string): string | null {
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/.exec(url);
  return m ? m[1] : null;
}
function vimeoId(url: string): string | null {
  const m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  return m ? m[1] : null;
}

function SplashVideo({ content, muted }: { content: Record<string, unknown>; muted: boolean }) {
  const url = (content.video_url as string) || "";
  const start = Number(content.video_start || 0);
  const end = Number(content.video_end || 0);
  const ref = React.useRef<HTMLVideoElement>(null);
  const yt = youtubeId(url);
  const vm = vimeoId(url);

  if (yt) {
    const params = new URLSearchParams({ autoplay: "1", controls: "1", playsinline: "1", rel: "0", mute: muted ? "1" : "0" });
    if (start) params.set("start", String(start));
    if (end) params.set("end", String(end));
    return <iframe className="aspect-video w-full max-w-2xl rounded-xl border-0" src={`https://www.youtube.com/embed/${yt}?${params.toString()}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  }
  if (vm) {
    return <iframe className="aspect-video w-full max-w-2xl rounded-xl border-0" src={`https://player.vimeo.com/video/${vm}?autoplay=1&muted=${muted ? 1 : 0}${start ? `#t=${start}s` : ""}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
  }
  if (!url) return null;
  return (
    <video
      ref={ref}
      src={url}
      className="w-full max-w-2xl rounded-xl"
      autoPlay
      playsInline
      muted={muted}
      controls
      onLoadedMetadata={() => { if (ref.current && start) ref.current.currentTime = start; }}
      onTimeUpdate={() => { if (ref.current && end && ref.current.currentTime >= end) ref.current.currentTime = start; }}
    />
  );
}

function SplashSlideshow({ slides }: { slides: { id: string; image_url: string; caption?: string }[] }) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 3500);
    return () => clearInterval(t);
  }, [slides.length]);
  if (!slides.length) return null;
  return (
    <div className="relative w-full max-w-2xl overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slides[i].image_url} alt={slides[i].caption || ""} className="h-72 w-full object-cover transition-opacity duration-500" />
      {slides[i].caption && <div className="absolute inset-x-0 bottom-0 bg-black/50 px-4 py-2 text-sm text-white">{slides[i].caption}</div>}
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {slides.map((s, idx) => <span key={s.id} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />)}
        </div>
      )}
    </div>
  );
}

function Splash({ content, card, onView }: { content: Record<string, unknown>; card: BusinessCard; onView: () => void }) {
  const accent = card.accent_color;
  const mode = (content.mode as string) || "standard";
  const transition = (content.transition as string) || "fade";
  const duration = Number(content.duration_seconds || 0);
  const muted = (content.video_muted as boolean) ?? true;
  const slides = (Array.isArray(content.slides) ? content.slides : []) as { id: string; image_url: string; caption?: string }[];

  const [shown, setShown] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  const close = React.useCallback(() => { setLeaving(true); window.setTimeout(onView, 450); }, [onView]);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (duration > 0) timer = setTimeout(close, duration * 1000);
    return () => { cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, [duration, close]);

  // Transition styles.
  const active = shown && !leaving;
  let transformStyle: React.CSSProperties = {};
  if (transition === "fade") transformStyle = { opacity: active ? 1 : 0 };
  else if (transition === "zoom") transformStyle = { opacity: active ? 1 : 0, transform: active ? "scale(1)" : leaving ? "scale(1.05)" : "scale(0.95)" };
  else if (transition === "slide-up") transformStyle = { transform: active ? "translateY(0)" : leaving ? "translateY(-100%)" : "translateY(100%)" };
  else if (transition === "slide-down") transformStyle = { transform: active ? "translateY(0)" : leaving ? "translateY(100%)" : "translateY(-100%)" };

  const eyebrow = (content.eyebrow as string) || "Digital Card";
  const title = (content.title as string) || "Welcome";
  const subtitle = (content.subtitle as string) || "Tap to view my digital business card.";
  const primary = (content.primary_label as string) || "View card";
  const secondary = (content.secondary_label as string) || (card.primary_phone ? "Call me" : "");
  const logo = (content.logo_url as string) || "";

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 text-center transition-all duration-[450ms] ease-out"
      style={{ background: card.background_color, color: card.text_color, ...transformStyle }}
    >
      {mode === "video" ? (
        <>
          <SplashVideo content={content} muted={muted} />
          <button onClick={close} className="mt-6 rounded-full px-6 py-2.5 text-sm font-semibold" style={{ background: "rgba(127,127,127,0.18)", color: accent }}>{primary}</button>
        </>
      ) : mode === "slideshow" ? (
        <>
          <SplashSlideshow slides={slides} />
          <button onClick={close} className="mt-6 rounded-full px-6 py-2.5 text-sm font-semibold" style={{ background: "rgba(127,127,127,0.18)", color: accent }}>{primary}</button>
        </>
      ) : (
        <>
          {logo && <img src={logo} alt="" className="mb-5 h-20 w-20 rounded-full object-cover" style={{ border: `2px solid ${accent}` }} />}
          <div className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ opacity: 0.6 }}>{eyebrow}</div>
          <h1 className="mt-3 text-5xl font-bold">{title}</h1>
          <p className="mt-2 text-sm" style={{ opacity: 0.7 }}>{subtitle}</p>
          <div className="mt-6 flex gap-3">
            <button onClick={close} className="rounded-full px-6 py-2.5 text-sm font-semibold" style={{ background: "rgba(127,127,127,0.18)", color: accent }}>{primary}</button>
            {secondary && card.primary_phone && (
              <a href={`tel:${card.primary_phone}`} className="rounded-full px-6 py-2.5 text-sm font-semibold" style={{ background: "rgba(127,127,127,0.18)", color: accent }}>{secondary}</a>
            )}
          </div>
          <div className="mt-6 text-[11px]" style={{ opacity: 0.5 }}>{card.slug}</div>
        </>
      )}
    </div>
  );
}

function LeadModal({ card, onClose, onSubmitted }: { card: BusinessCard; onClose: () => void; onSubmitted: () => void }) {
  const settings = card.lead_form_settings;
  const fields = (settings?.fields ?? []).filter((f) => f.enabled);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/cards/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, ...values }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit.");
      setDone(true);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-5" style={{ background: card.background_color, color: card.text_color, border: "1px solid rgba(127,127,127,0.25)" }}>
        <button onClick={onClose} className="absolute right-3 top-3 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
        {done ? (
          <div className="py-8 text-center">
            <div className="text-lg font-semibold">Thank you!</div>
            <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>Your info was sent. {card.display_name || "We"} will follow up shortly.</p>
            <button onClick={onClose} className="mt-5 rounded-full px-6 py-2 text-sm font-semibold" style={{ background: card.accent_color, color: card.background_color }}>Close</button>
          </div>
        ) : (
          <>
            <div className="text-lg font-semibold">{settings?.title || "Send me your info"}</div>
            {settings?.description && <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>{settings.description}</p>}
            <div className="mt-4 space-y-2.5">
              {fields.map((f: LeadFormField) => (
                f.key === "message" ? (
                  <textarea
                    key={f.key}
                    placeholder={f.label + (f.required ? " *" : "")}
                    value={values[f.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    rows={3}
                    className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: "rgba(127,127,127,0.12)", color: card.text_color, border: "1px solid rgba(127,127,127,0.2)" }}
                  />
                ) : (
                  <input
                    key={f.key}
                    placeholder={f.label + (f.required ? " *" : "")}
                    type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"}
                    value={values[f.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: "rgba(127,127,127,0.12)", color: card.text_color, border: "1px solid rgba(127,127,127,0.2)" }}
                  />
                )
              ))}
            </div>
            {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
            <button onClick={submit} disabled={submitting} className="mt-4 w-full rounded-full py-2.5 text-sm font-semibold disabled:opacity-50" style={{ background: card.accent_color, color: card.background_color }}>
              {submitting ? "Sending…" : (settings?.submit_label || "Send info")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
