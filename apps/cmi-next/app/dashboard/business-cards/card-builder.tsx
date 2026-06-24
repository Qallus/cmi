"use client";

import * as React from "react";
import {
  ArrowLeft, ChevronDown, ChevronUp, ClipboardList, Copy, Eye, EyeOff,
  GalleryHorizontal, IdCard, Image as ImageIcon, Layers, Link as LinkIcon,
  ListChecks, Palette, PlayCircle, Plus, QrCode, Save, Settings, Smartphone,
  Sparkles, Trash2, Upload, User, Wand2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CardPreview } from "@/components/business-card/card-preview";
import { COLOR_PRESETS, makeDefaultSections, makeNewCard } from "@/lib/business-cards/defaults";
import type {
  BusinessCard, BusinessCardLink, BusinessCardSection, LinkType, SaveCardPayload, ThemeMode,
} from "@/lib/business-cards/types";
import type { StaffOption } from "@/lib/business-cards/data";

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://my.constructedmatter.com").replace(/\/$/, "");

type PanelKey =
  | "sections" | "content" | "links" | "color" | "splash" | "qr"
  | "forms" | "nfc" | "media" | "slideshow" | "steps" | "automate" | "settings" | "wizard";

const PANELS: { key: PanelKey; label: string; icon: React.ElementType; soon?: boolean }[] = [
  { key: "sections", label: "Sections", icon: Layers },
  { key: "content", label: "Content", icon: User },
  { key: "links", label: "Links", icon: LinkIcon },
  { key: "color", label: "Color modes", icon: Palette },
  { key: "splash", label: "Splash page", icon: PlayCircle },
  { key: "qr", label: "QR code", icon: QrCode },
  { key: "forms", label: "Forms", icon: ClipboardList },
  { key: "nfc", label: "NFC", icon: Smartphone },
  { key: "media", label: "Media", icon: ImageIcon, soon: true },
  { key: "slideshow", label: "Slideshow", icon: GalleryHorizontal, soon: true },
  { key: "steps", label: "Steps", icon: ListChecks, soon: true },
  { key: "automate", label: "Automations", icon: Zap, soon: true },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "wizard", label: "Setup wizard", icon: Wand2 },
];

const LINK_TYPES: LinkType[] = ["website", "social", "phone", "email", "sms", "map", "booking", "payment", "download", "video", "review", "custom"];

const iCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent";

function uid() { try { return crypto.randomUUID(); } catch { return `tmp-${Math.random().toString(36).slice(2)}`; } }

export function CardBuilder({
  card, isAdmin, staffOptions, currentStaffId, onClose, onSaved,
}: {
  card: BusinessCard | null;
  isAdmin: boolean;
  staffOptions: StaffOption[];
  currentStaffId: string | null;
  onClose: () => void;
  onSaved: (card: BusinessCard) => void;
}) {
  const [draft, setDraft] = React.useState<BusinessCard>(() => card ?? makeNewCard());
  const [links, setLinks] = React.useState<BusinessCardLink[]>(
    () => (card?.business_card_links ?? []).slice().sort((a, b) => a.display_order - b.display_order),
  );
  const [sections, setSections] = React.useState<BusinessCardSection[]>(
    () => (card?.business_card_sections?.length ? card.business_card_sections.slice().sort((a, b) => a.display_order - b.display_order) : makeDefaultSections()),
  );
  const [panel, setPanel] = React.useState<PanelKey>("content");
  const [device, setDevice] = React.useState<"mobile" | "tablet" | "desktop">("mobile");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function set<K extends keyof BusinessCard>(key: K, value: BusinessCard[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const publicUrl = `${PUBLIC_BASE}/c/${draft.slug || "preview"}`;

  async function persist(status?: BusinessCard["status"]) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: SaveCardPayload = {
        ...draft,
        ...(draft.id ? { id: draft.id } : {}),
        ...(status ? { status } : {}),
        links,
        sections,
      };
      if (!draft.id) delete (payload as { id?: string }).id;
      const res = await fetch("/api/business-cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed.");
      setDraft(json.card);
      setLinks((json.card.business_card_links ?? []).slice().sort((a: BusinessCardLink, b: BusinessCardLink) => a.display_order - b.display_order));
      setSections((json.card.business_card_sections ?? []).slice().sort((a: BusinessCardSection, b: BusinessCardSection) => a.display_order - b.display_order));
      setNotice(status === "published" ? "Published!" : "Saved.");
      onSaved(json.card);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const deviceWidth = device === "mobile" ? "max-w-[360px]" : device === "tablet" ? "max-w-[460px]" : "max-w-[560px]";

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <IdCard className="h-4 w-4 text-accent" />
            <span className="font-display text-lg font-semibold">{draft.id ? "Edit card" : "New card"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notice && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{notice}</span>}
          {error && <span className="text-xs font-medium text-destructive">{error}</span>}
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(publicUrl)}><Copy className="h-3.5 w-3.5" /> Copy URL</Button>
          {draft.status === "published" && <a href={publicUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5" /> Public page</Button></a>}
          <Button size="sm" variant="outline" onClick={() => persist("published")} disabled={saving}>Publish &amp; save</Button>
          <Button size="sm" variant="accent" onClick={() => persist()} disabled={saving}><Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save card"}</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left rail */}
        <div className="w-[150px] shrink-0 overflow-y-auto border-r border-border bg-card/40 py-2">
          {PANELS.map(({ key, label, icon: Icon, soon }) => (
            <button
              key={key}
              onClick={() => setPanel(key)}
              className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition", panel === key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              {soon && <span className="ml-auto rounded bg-muted px-1 text-[8px] uppercase text-muted-foreground">soon</span>}
            </button>
          ))}
        </div>

        {/* Panel editor */}
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-border p-4">
          <PanelBody
            panel={panel}
            draft={draft}
            set={set}
            setDraft={setDraft}
            links={links}
            setLinks={setLinks}
            sections={sections}
            setSections={setSections}
            isAdmin={isAdmin}
            staffOptions={staffOptions}
            currentStaffId={currentStaffId}
            publicUrl={publicUrl}
          />
        </div>

        {/* Live preview */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-muted/30 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Live preview</div>
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
              {(["mobile", "tablet", "desktop"] as const).map((d) => (
                <button key={d} onClick={() => setDevice(d)} className={cn("rounded-md px-3 py-1 font-medium capitalize", device === d ? "bg-accent/15 text-accent" : "text-muted-foreground")}>{d}</button>
              ))}
            </div>
          </div>
          <div className={cn("mx-auto w-full", deviceWidth)}>
            <CardPreview card={draft} links={links} sections={sections} publicUrl={publicUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field helpers ──────────────────────────────────────────────────────────────

function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <F label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-background" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={iCls} />
      </div>
    </F>
  );
}

async function uploadFile(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", "business-cards");
  const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url ?? null;
}

function ImageField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <F label={label}>
      <div className="flex items-center gap-2">
        {value
          ? <img src={value} alt="" className="h-10 w-10 rounded object-cover" />
          : <div className="grid h-10 w-10 place-items-center rounded bg-muted text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>}
        <label className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
          <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setBusy(true); const url = await uploadFile(f); setBusy(false);
            if (url) onChange(url);
          }} />
        </label>
        {value && <button onClick={() => onChange(null)} className="text-xs text-destructive">Remove</button>}
      </div>
    </F>
  );
}

// ── Panel body ─────────────────────────────────────────────────────────────────

function PanelBody(props: {
  panel: PanelKey;
  draft: BusinessCard;
  set: <K extends keyof BusinessCard>(k: K, v: BusinessCard[K]) => void;
  setDraft: React.Dispatch<React.SetStateAction<BusinessCard>>;
  links: BusinessCardLink[];
  setLinks: React.Dispatch<React.SetStateAction<BusinessCardLink[]>>;
  sections: BusinessCardSection[];
  setSections: React.Dispatch<React.SetStateAction<BusinessCardSection[]>>;
  isAdmin: boolean;
  staffOptions: StaffOption[];
  currentStaffId: string | null;
  publicUrl: string;
}) {
  const { panel, draft, set, setDraft, links, setLinks, sections, setSections, isAdmin, staffOptions, publicUrl } = props;

  // ── Sections ──
  if (panel === "sections") {
    function move(i: number, dir: -1 | 1) {
      const j = i + dir;
      if (j < 0 || j >= sections.length) return;
      const next = sections.slice();
      [next[i], next[j]] = [next[j], next[i]];
      setSections(next.map((s, idx) => ({ ...s, display_order: idx + 1 })));
    }
    return (
      <Section title="Sections & layers">
        <p className="mb-3 text-xs text-muted-foreground">Toggle, reorder, and space the sections shown on your public card.</p>
        {sections.map((s, i) => (
          <div key={s.id} className="mb-2 rounded-lg border border-border bg-card p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">{s.label}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="text-muted-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              <button onClick={() => setSections(sections.map((x) => x.id === s.id ? { ...x, is_visible: !x.is_visible } : x))} className={cn(s.is_visible ? "text-accent" : "text-muted-foreground")}>
                {s.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Bottom space</span>
              <input type="range" min={0} max={48} value={s.margin_bottom} onChange={(e) => setSections(sections.map((x) => x.id === s.id ? { ...x, margin_bottom: Number(e.target.value) } : x))} className="flex-1" />
              <span className="w-8 text-right text-[10px] text-muted-foreground">{s.margin_bottom}</span>
            </div>
          </div>
        ))}
      </Section>
    );
  }

  // ── Content ──
  if (panel === "content") {
    return (
      <>
        <Section title="Profile">
          <ImageField label="Profile photo" value={draft.profile_photo_url} onChange={(v) => set("profile_photo_url", v)} />
          <ImageField label="Logo (optional)" value={draft.logo_url} onChange={(v) => set("logo_url", v)} />
          <F label="Display name"><input className={iCls} value={draft.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} /></F>
          <div className="grid grid-cols-2 gap-2">
            <F label="First name"><input className={iCls} value={draft.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} /></F>
            <F label="Last name"><input className={iCls} value={draft.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} /></F>
          </div>
          <F label="Job title"><input className={iCls} value={draft.job_title ?? ""} onChange={(e) => set("job_title", e.target.value)} /></F>
          <F label="Company"><input className={iCls} value={draft.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} /></F>
          <F label="Department"><input className={iCls} value={draft.department ?? ""} onChange={(e) => set("department", e.target.value)} /></F>
          <F label="Bio"><textarea className={cn(iCls, "h-20 resize-none py-2")} value={draft.bio ?? ""} onChange={(e) => set("bio", e.target.value)} /></F>
        </Section>
        <Section title="Contact">
          <F label="Phone"><input className={iCls} value={draft.primary_phone ?? ""} onChange={(e) => set("primary_phone", e.target.value)} placeholder="+1 480 555 0100" /></F>
          <F label="SMS number"><input className={iCls} value={draft.sms_phone ?? ""} onChange={(e) => set("sms_phone", e.target.value)} /></F>
          <F label="Email"><input className={iCls} value={draft.primary_email ?? ""} onChange={(e) => set("primary_email", e.target.value)} /></F>
          <F label="Website"><input className={iCls} value={draft.website_url ?? ""} onChange={(e) => set("website_url", e.target.value)} /></F>
          <F label="Map / address URL"><input className={iCls} value={draft.maps_url ?? ""} onChange={(e) => set("maps_url", e.target.value)} /></F>
          <F label="Intro video URL"><input className={iCls} value={draft.intro_video_url ?? ""} onChange={(e) => set("intro_video_url", e.target.value)} placeholder="YouTube / Vimeo link" /></F>
        </Section>
      </>
    );
  }

  // ── Links ──
  if (panel === "links") {
    function add() {
      setLinks([...links, { id: uid(), label: "New link", url: "", link_type: "custom", icon: null, display_order: links.length + 1, is_visible: true, open_in_new_tab: true, click_count: 0 }]);
    }
    function update(id: string, patch: Partial<BusinessCardLink>) {
      setLinks(links.map((l) => l.id === id ? { ...l, ...patch } : l));
    }
    return (
      <Section title="Links & socials">
        <p className="mb-3 text-xs text-muted-foreground">Buttons shown in the Links section of your card.</p>
        {links.map((l) => (
          <div key={l.id} className="mb-2 rounded-lg border border-border bg-card p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <input className={cn(iCls, "h-8")} value={l.label} onChange={(e) => update(l.id, { label: e.target.value })} placeholder="Label" />
              <button onClick={() => update(l.id, { is_visible: !l.is_visible })} className={cn(l.is_visible ? "text-accent" : "text-muted-foreground")}>{l.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
              <button onClick={() => setLinks(links.filter((x) => x.id !== l.id))} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <input className={cn(iCls, "mb-2 h-8")} value={l.url} onChange={(e) => update(l.id, { url: e.target.value })} placeholder="https://…" />
            <select className={cn(iCls, "h-8")} value={l.link_type} onChange={(e) => update(l.id, { link_type: e.target.value as LinkType })}>
              {LINK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5" /> Add link</Button>
      </Section>
    );
  }

  // ── Color modes ──
  if (panel === "color") {
    return (
      <Section title="Colors & theme">
        <F label="Theme mode">
          <select className={iCls} value={draft.theme_mode} onChange={(e) => set("theme_mode", e.target.value as ThemeMode)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="both">Both (visitor toggle)</option>
          </select>
        </F>
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Presets</div>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((p) => (
              <button key={p.name} onClick={() => setDraft((d) => ({ ...d, background_color: p.bg, accent_color: p.accent, text_color: p.text }))} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-muted">
                <span className="h-3 w-3 rounded-full" style={{ background: p.bg, border: `1px solid ${p.accent}` }} />{p.name}
              </button>
            ))}
          </div>
        </div>
        <ColorField label="Background" value={draft.background_color} onChange={(v) => set("background_color", v)} />
        <ColorField label="Accent" value={draft.accent_color} onChange={(v) => set("accent_color", v)} />
        <ColorField label="Text" value={draft.text_color} onChange={(v) => set("text_color", v)} />
      </Section>
    );
  }

  // ── Splash / opener ──
  if (panel === "splash") {
    const opener = sections.find((s) => s.section_type === "opener");
    const content = (opener?.content || {}) as Record<string, string>;
    function setContent(patch: Record<string, string>) {
      setSections(sections.map((s) => s.section_type === "opener" ? { ...s, content: { ...content, ...patch } } : s));
    }
    return (
      <Section title="Splash / opener page">
        <F label="Show splash before card">
          <button onClick={() => setSections(sections.map((s) => s.section_type === "opener" ? { ...s, is_visible: !s.is_visible } : s))} className={cn("flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm", opener?.is_visible ? "text-accent" : "text-muted-foreground")}>
            {opener?.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{opener?.is_visible ? "Enabled" : "Disabled"}
          </button>
        </F>
        <F label="Eyebrow"><input className={iCls} value={content.eyebrow ?? ""} onChange={(e) => setContent({ eyebrow: e.target.value })} placeholder="Digital Card" /></F>
        <F label="Title"><input className={iCls} value={content.title ?? ""} onChange={(e) => setContent({ title: e.target.value })} placeholder="Welcome" /></F>
        <F label="Subtitle"><input className={iCls} value={content.subtitle ?? ""} onChange={(e) => setContent({ subtitle: e.target.value })} placeholder="Tap to view my digital business card." /></F>
        <F label="Primary button"><input className={iCls} value={content.primary_label ?? ""} onChange={(e) => setContent({ primary_label: e.target.value })} placeholder="View card" /></F>
        <F label="Secondary button"><input className={iCls} value={content.secondary_label ?? ""} onChange={(e) => setContent({ secondary_label: e.target.value })} placeholder="Call me" /></F>
      </Section>
    );
  }

  // ── QR ──
  if (panel === "qr") {
    const qr = draft.qr_settings || {};
    const fg = qr.foreground || draft.background_color;
    return (
      <Section title="QR code">
        <div className="mb-3 flex justify-center rounded-lg border border-border bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/cards/qr?url=${encodeURIComponent(publicUrl)}&size=320&fg=${encodeURIComponent(fg)}`} alt="QR" className="h-40 w-40" />
        </div>
        <ColorField label="QR foreground" value={fg} onChange={(v) => set("qr_settings", { ...qr, foreground: v })} />
        <a href={`/api/cards/qr?url=${encodeURIComponent(publicUrl)}&size=1024&fg=${encodeURIComponent(fg)}`} download={`${draft.slug || "card"}-qr.png`}>
          <Button size="sm" variant="outline" className="w-full"><QrCode className="h-3.5 w-3.5" /> Download PNG</Button>
        </a>
        <p className="mt-2 text-[10px] text-muted-foreground">QR encodes the public card URL. Save the card first to lock in the final slug.</p>
      </Section>
    );
  }

  // ── Forms / lead capture ──
  if (panel === "forms") {
    const lf = draft.lead_form_settings;
    function setLF(patch: Partial<typeof lf>) { set("lead_form_settings", { ...lf, ...patch }); }
    return (
      <Section title="Lead capture form">
        <F label="Enable “Send me your info”">
          <button onClick={() => setLF({ enabled: !lf.enabled })} className={cn("flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm", lf.enabled ? "text-accent" : "text-muted-foreground")}>
            {lf.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{lf.enabled ? "Enabled" : "Disabled"}
          </button>
        </F>
        <F label="Title"><input className={iCls} value={lf.title} onChange={(e) => setLF({ title: e.target.value })} /></F>
        <F label="Description"><input className={iCls} value={lf.description} onChange={(e) => setLF({ description: e.target.value })} /></F>
        <F label="Button label"><input className={iCls} value={lf.button_label} onChange={(e) => setLF({ button_label: e.target.value })} /></F>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Fields</div>
        {lf.fields.map((field, i) => (
          <div key={field.key} className="mb-1.5 flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm">
            <span className="flex-1 capitalize">{field.label}</span>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground"><input type="checkbox" checked={field.enabled} onChange={(e) => setLF({ fields: lf.fields.map((f, j) => j === i ? { ...f, enabled: e.target.checked } : f) })} /> on</label>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground"><input type="checkbox" checked={field.required} onChange={(e) => setLF({ fields: lf.fields.map((f, j) => j === i ? { ...f, required: e.target.checked } : f) })} /> req</label>
          </div>
        ))}
      </Section>
    );
  }

  // ── NFC ──
  if (panel === "nfc") {
    return (
      <Section title="NFC tap-to-share">
        <F label="NFC status">
          <select className={iCls} value={draft.nfc_status} onChange={(e) => set("nfc_status", e.target.value)}>
            <option value="not_ordered">Not ordered</option>
            <option value="ordered">Ordered</option>
            <option value="assigned">Assigned to a tag</option>
            <option value="active">Active</option>
          </select>
        </F>
        <p className="text-xs text-muted-foreground">Program a physical NFC tag to open <span className="font-mono">{publicUrl}?source=nfc</span>. Tap analytics are recorded automatically. Toggle the “NFC tap to share” section under Sections to show a note on the card.</p>
      </Section>
    );
  }

  // ── Settings ──
  if (panel === "settings") {
    return (
      <Section title="Card settings">
        <F label="Card name (internal)"><input className={iCls} value={draft.card_name} onChange={(e) => set("card_name", e.target.value)} /></F>
        <F label="Public slug" hint="Used in the public URL. Leave blank to auto-generate from the name.">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">/c/</span>
            <input className={iCls} value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto" />
          </div>
        </F>
        <F label="Status">
          <select className={iCls} value={draft.status} onChange={(e) => set("status", e.target.value as BusinessCard["status"])}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </F>
        {isAdmin && (
          <F label="Assign to employee" hint="Super admins can assign this card to any staff member.">
            <select className={iCls} value={draft.staff_user_id ?? ""} onChange={(e) => set("staff_user_id", e.target.value || null)}>
              <option value="">Unassigned</option>
              {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.display_name}{s.role_slug ? ` (${s.role_slug})` : ""}</option>)}
            </select>
          </F>
        )}
      </Section>
    );
  }

  // ── Wizard ──
  if (panel === "wizard") {
    const steps = [
      { done: Boolean(draft.display_name), label: "Add your name & title" },
      { done: Boolean(draft.profile_photo_url), label: "Upload a profile photo" },
      { done: Boolean(draft.primary_phone || draft.primary_email), label: "Add contact details" },
      { done: links.length > 0 || Boolean(draft.website_url), label: "Add at least one link" },
      { done: draft.lead_form_settings.enabled, label: "Enable lead capture" },
      { done: draft.status === "published", label: "Publish your card" },
    ];
    return (
      <Section title="Setup wizard">
        <p className="mb-3 text-xs text-muted-foreground">Finish these to get a polished, shareable card.</p>
        {steps.map((s, i) => (
          <div key={i} className="mb-2 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
            <span className={cn("grid h-4 w-4 place-items-center rounded-full text-[10px]", s.done ? "bg-emerald-500 text-white" : "border border-border text-muted-foreground")}>{s.done ? "✓" : i + 1}</span>
            <span className={cn(s.done && "text-muted-foreground line-through")}>{s.label}</span>
          </div>
        ))}
      </Section>
    );
  }

  // ── Coming-soon panels ──
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
      <div className="text-sm font-semibold capitalize">{panel}</div>
      <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
        This panel is coming in a later phase. The card already works great without it.
      </p>
    </div>
  );
}
