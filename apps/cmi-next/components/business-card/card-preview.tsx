"use client";

// Presentational card body — shared by the public page and the builder preview.
// No network calls; the parent supplies handlers for clicks/actions.

import { ExternalLink, Mail, MessageSquare, Phone, QrCode } from "lucide-react";
import type { BusinessCard, BusinessCardLink, BusinessCardSection } from "@/lib/business-cards/types";

export type PreviewCard = Pick<
  BusinessCard,
  | "display_name" | "first_name" | "last_name" | "job_title" | "company_name" | "bio"
  | "profile_photo_url" | "logo_url" | "background_color" | "accent_color" | "text_color"
  | "primary_phone" | "sms_phone" | "primary_email" | "website_url" | "maps_url" | "intro_video_url"
  | "lead_form_settings" | "slug"
>;

function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function CardPreview({
  card,
  links,
  sections,
  publicUrl,
  onLink,
  onAction,
}: {
  card: PreviewCard;
  links: BusinessCardLink[];
  sections: BusinessCardSection[];
  publicUrl: string;
  onLink?: (link: BusinessCardLink) => void;
  onAction?: (action: "call" | "sms" | "email" | "map" | "lead" | "website" | "video") => void;
}) {
  const bg = card.background_color || "#0f1c14";
  const accent = card.accent_color || "#c8a35b";
  const text = card.text_color || "#f5f3ee";
  const surface = hexAlpha(text, 0.06);
  const border = hexAlpha(text, 0.12);

  const name = card.display_name || [card.first_name, card.last_name].filter(Boolean).join(" ") || "Your Name";
  const subtitle = [card.job_title, card.company_name].filter(Boolean).join(" · ");

  const ordered = [...sections]
    .filter((s) => s.is_visible && s.section_type !== "opener")
    .sort((a, b) => a.display_order - b.display_order);

  const pill = (label: string, icon: React.ReactNode, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-3 text-xs font-medium transition active:scale-95"
      style={{ background: surface, border: `1px solid ${border}`, color: accent }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const linkRow = (label: string, onClick?: () => void, key?: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99]"
      style={{ background: surface, border: `1px solid ${border}`, color: text }}
    >
      <span>{label}</span>
      <ExternalLink className="h-4 w-4 opacity-60" />
    </button>
  );

  function renderSection(s: BusinessCardSection) {
    const wrap = (node: React.ReactNode) => (
      <div key={s.id} style={{ marginTop: s.margin_top, marginBottom: s.margin_bottom, paddingTop: s.padding_top, paddingBottom: s.padding_bottom }}>
        {node}
      </div>
    );

    switch (s.section_type) {
      case "profile_header":
        return wrap(
          <div className="flex flex-col items-center text-center">
            {card.logo_url
              ? <img src={card.logo_url} alt="" className="mb-3 h-6 object-contain" />
              : <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: hexAlpha(text, 0.5) }}>{card.company_name || "Digital Card"}</div>}
            {card.profile_photo_url
              ? <img src={card.profile_photo_url} alt={name} className="h-24 w-24 rounded-full object-cover" style={{ border: `2px solid ${border}` }} />
              : <div className="grid h-24 w-24 place-items-center rounded-full text-2xl font-semibold" style={{ background: surface, color: accent, border: `2px solid ${border}` }}>{name.slice(0, 1)}</div>}
            <div className="mt-3 text-lg font-semibold" style={{ color: text }}>{name}</div>
            {subtitle && <div className="mt-0.5 text-xs font-medium" style={{ color: hexAlpha(text, 0.7) }}>{subtitle}</div>}
            {card.bio && <p className="mt-2 text-xs leading-5" style={{ color: hexAlpha(text, 0.7) }}>{card.bio}</p>}
          </div>,
        );
      case "quick_actions": {
        const actions: React.ReactNode[] = [];
        if (card.primary_phone) actions.push(pill("Call", <Phone className="h-4 w-4" />, () => onAction?.("call")));
        if (card.sms_phone || card.primary_phone) actions.push(pill("SMS", <MessageSquare className="h-4 w-4" />, () => onAction?.("sms")));
        if (card.primary_email) actions.push(pill("Email", <Mail className="h-4 w-4" />, () => onAction?.("email")));
        if (!actions.length) return null;
        return wrap(<div className="flex gap-2">{actions}</div>);
      }
      case "links": {
        const rows: React.ReactNode[] = [];
        if (card.website_url) rows.push(linkRow("Website", () => onAction?.("website"), "website"));
        for (const l of links.filter((x) => x.is_visible)) {
          rows.push(linkRow(l.label || "Link", () => onLink?.(l), l.id));
        }
        if (!rows.length) return null;
        return wrap(<div className="flex flex-col gap-2">{rows}</div>);
      }
      case "lead_capture": {
        if (!card.lead_form_settings?.enabled) return null;
        return wrap(
          <button
            type="button"
            onClick={() => onAction?.("lead")}
            className="w-full rounded-xl py-3 text-sm font-semibold transition active:scale-[0.99]"
            style={{ background: accent, color: bg }}
          >
            {card.lead_form_settings?.button_label || "Send me your info"}
          </button>,
        );
      }
      case "video": {
        if (!card.intro_video_url) {
          return wrap(<div className="rounded-xl px-4 py-3 text-xs" style={{ background: surface, border: `1px solid ${border}`, color: hexAlpha(text, 0.6) }}>
            <div className="font-semibold" style={{ color: text }}>Intro video</div>
            Add an intro video URL to show this section.
          </div>);
        }
        return wrap(linkRow("Watch intro video", () => onAction?.("video")));
      }
      case "qr_code":
        return wrap(
          <div className="flex justify-center">
            <div className="rounded-xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/cards/qr?url=${encodeURIComponent(publicUrl)}&size=320&fg=${encodeURIComponent(card.background_color || "#0f1c14")}`}
                alt="QR code"
                className="h-36 w-36"
              />
            </div>
          </div>,
        );
      case "nfc":
        return wrap(<div className="rounded-xl px-4 py-3 text-xs" style={{ background: surface, border: `1px solid ${border}`, color: hexAlpha(text, 0.6) }}>
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: text }}><QrCode className="h-3.5 w-3.5" />NFC tap to share</div>
          NFC tap-to-share will use this public URL once a physical product is linked.
        </div>);
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-[26px] p-5" style={{ background: bg, color: text, border: `1px solid ${border}` }}>
      {ordered.map(renderSection)}
      <div className="mt-4 text-center text-[10px]" style={{ color: hexAlpha(text, 0.4) }}>Powered by Constructed Matter</div>
    </div>
  );
}
