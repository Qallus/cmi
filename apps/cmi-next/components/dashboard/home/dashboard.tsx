"use client";

// The Overview dashboard: sections of cards you can move (drag in Customize),
// resize, hide, remove and add from "Add card". Saved to your account (or this
// browser if saving fails). Ported from Echo (components/dashboard/dashboard.tsx).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Check, Eye, LayoutDashboard, LayoutGrid, Loader2, Plus, RotateCcw, Settings2, Sparkles, Star } from "lucide-react";
import { RowActionsMenu, type RowAction } from "@/components/ui/row-actions-menu";
import { CARDS } from "@/lib/dashboard/cards";
import { cardAllowed } from "@/lib/dashboard/access";
import type { DashboardData } from "@/lib/dashboard/data";
import { BLANK, copy, newId, normalize, STANDARD, typesIn, type Card, type CardType, type Layout, type Section } from "@/lib/dashboard/layout";
import { cn } from "@/lib/utils";
import { AddCardPanel, NEW_SECTION } from "./add-card";
import { CardShell } from "./card-shell";
import { RenderCard } from "./cards";
import { FeatureMenu } from "./feature-menu";
import { SectionView } from "./section-view";
import { StartChooser } from "./start-chooser";

type Props = { initial: Layout | null; chooser: boolean; data: DashboardData; slots: { outlook?: React.ReactNode } };

const LOCAL = "cmi.dashboard.v1";
const noop = () => () => {};

export function Dashboard(props: Props) {
  // Render after hydration, so a layout kept in this browser can be read.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return <div className="space-y-4 p-4 md:p-6">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/60" />)}</div>;
  return <Inner {...props} />;
}

// Quick picks on a Blank dashboard, by focus.
const FOCUS: { id: string; label: string; cards: CardType[] }[] = [
  { id: "office", label: "Office and admin", cards: ["my_tasks", "notifications", "mini_calendar", "stat_bookings", "stat_emails", "quick_links", "notepad", "admin_shortcuts"] },
  { id: "sales", label: "Sales and Pipeline", cards: ["my_tasks", "stat_pipeline", "chart_pipeline", "stat_contacts", "stat_precon", "stat_calls", "dialpad", "upcoming"] },
  { id: "pm", label: "Project management", cards: ["my_tasks", "job_alert", "stat_jobs", "chart_jobs", "schedules_look", "stat_punch", "stat_daily_logs", "mini_calendar"] },
  { id: "field", label: "Field", cards: ["my_tasks", "weather", "job_alert", "stat_punch", "stat_daily_logs", "next_up", "recorder", "notepad"] },
];

function readLocal(allow: (t: CardType) => boolean): Layout | null {
  try { return normalize(JSON.parse(localStorage.getItem(LOCAL) ?? "null"), allow); } catch { return null; }
}

async function saveLayout(layout: Layout): Promise<{ error?: string }> {
  const res = await fetch("/api/dashboard/layout", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout }) });
  if (!res.ok) return { error: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "offline" };
  return {};
}

function Inner({ initial, chooser, data, slots }: Props) {
  const router = useRouter();
  const allow = (t: CardType) => cardAllowed(t, data.role, data.flags);
  const [layout, setLayout] = useState<Layout | null>(() => initial ?? (chooser ? readLocal(allow) : null));
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<string>(() => (initial ?? STANDARD).sections.at(-1)?.id ?? NEW_SECTION);
  const [features, setFeatures] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "local">("idle");
  const [active, setActive] = useState<string | null>(null);
  const [defaultMsg, setDefaultMsg] = useState<string | null>(null);
  const saved = useRef(JSON.stringify(initial));
  const loadedTypes = useRef(typesIn(initial ?? STANDARD));

  // Save shortly after each change (nothing to save if it's what was loaded).
  useEffect(() => {
    if (!layout) return;
    const json = JSON.stringify(layout);
    if (json === saved.current) return;
    const t = setTimeout(async () => {
      setStatus("saving");
      const res = await saveLayout(layout).catch(() => ({ error: "offline" }));
      saved.current = json;
      if (res.error) { try { localStorage.setItem(LOCAL, json); } catch { /* storage blocked */ } setStatus("local"); }
      else {
        setStatus("saved");
        // A card that needs data the page didn't load (just added): reload the data.
        const now = typesIn(layout);
        if ([...now].some((t) => !loadedTypes.current.has(t))) { loadedTypes.current = now; router.refresh(); }
      }
    }, 800);
    return () => clearTimeout(t);
  }, [layout, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pick = (t: "standard" | "blank") => { const base = t === "blank" ? BLANK : STANDARD; setLayout(normalize(copy(base), allow)); if (t === "blank") setTarget("mine"); };
  if (!layout) return <div className="p-4 md:p-6"><StartChooser name={data.firstName} onPick={pick} /></div>;

  const update = (fn: (l: Layout) => Layout) => setLayout((l) => (l ? fn(copy(l)) : l));
  const patchSection = (id: string, patch: Partial<Section>) => update((l) => ({ ...l, sections: l.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const patchCard = (id: string, patch: Partial<Card>) =>
    update((l) => ({ ...l, sections: l.sections.map((s) => ({ ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })) }));
  const removeCard = (id: string) => update((l) => ({ ...l, sections: l.sections.map((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) })) }));
  const findSection = (l: Layout, cardId: string) => l.sections.find((s) => s.cards.some((c) => c.id === cardId));

  const addCard = (type: CardType, where = target) => {
    const card: Card = { id: newId(type), type, size: CARDS[type].size };
    const known = where !== NEW_SECTION && layout.sections.some((s) => s.id === where);
    const into = known ? where : newId("s");
    if (!known) setTarget(into);
    update((l) => {
      const sections = l.sections.some((s) => s.id === into) ? l.sections : [...l.sections, { id: into, title: "My cards", style: "grid" as const, cards: [] }];
      return { ...l, sections: sections.map((s) => (s.id === into ? { ...s, hidden: false, collapsed: false, cards: [...s.cards, card] } : s)) };
    });
  };
  const showCard = (type: CardType) => update((l) => ({ ...l, sections: l.sections.map((s) => ({ ...s, cards: s.cards.map((c) => (c.type === type ? { ...c, hidden: false } : c)) })) }));
  const openAdd = (sectionId?: string) => { if (sectionId) setTarget(sectionId); setAdding(true); };

  // Drag: sections up and down; cards within and between sections.
  const onStart = (e: DragStartEvent) => setActive(String(e.active.id));
  const onOver = (e: DragOverEvent) => {
    const { active: a, over } = e;
    if (!over || a.data.current?.kind !== "card") return;
    const overId = String(over.id);
    update((l) => {
      const from = findSection(l, String(a.id));
      const to = over.data.current?.kind === "drop" ? l.sections.find((s) => s.id === over.data.current?.section) : findSection(l, overId);
      if (!from || !to || from.id === to.id) return l;
      const moving = from.cards.find((c) => c.id === String(a.id))!;
      const at = to.cards.findIndex((c) => c.id === overId);
      from.cards = from.cards.filter((c) => c.id !== moving.id);
      to.cards.splice(at < 0 ? to.cards.length : at, 0, moving);
      return l;
    });
  };
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    if (a.data.current?.kind === "section") {
      update((l) => {
        const i = l.sections.findIndex((s) => s.id === a.id), j = l.sections.findIndex((s) => s.id === over.id);
        return i < 0 || j < 0 ? l : { ...l, sections: arrayMove(l.sections, i, j) };
      });
      return;
    }
    update((l) => {
      const s = findSection(l, String(a.id));
      if (!s) return l;
      const i = s.cards.findIndex((c) => c.id === a.id), j = s.cards.findIndex((c) => c.id === over.id);
      if (i >= 0 && j >= 0) s.cards = arrayMove(s.cards, i, j);
      return l;
    });
  };

  async function makeDefault() {
    setDefaultMsg(null);
    const res = await fetch("/api/dashboard/defaults", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout }) });
    setDefaultMsg(res.ok ? "Saved as the company default for people who haven't set up their dashboard." : "Couldn't save the company default.");
  }

  const hiddenSections = layout.sections.filter((s) => s.hidden);
  const hiddenCards = layout.sections.flatMap((s) => s.cards.filter((c) => c.hidden));
  const placed = layout.sections.flatMap((s) => s.cards).filter((c) => !c.hidden && c.type !== "get_started");
  const activeCard = active ? layout.sections.flatMap((s) => s.cards).find((c) => c.id === active) : null;
  const firstDialpadId = layout.sections.flatMap((s) => (s.hidden ? [] : s.cards)).find((c) => c.type === "dialpad" && !c.hidden)?.id ?? null;
  const ctx = { data, slots, openFeatures: () => setFeatures(true), customize: () => setEdit(true), firstDialpadId };

  const menu: RowAction[] = [
    ...hiddenSections.map((s) => ({ key: `s-${s.id}`, label: `Show section: ${s.title}`, icon: Eye, run: () => patchSection(s.id, { hidden: false }) })),
    ...hiddenCards.slice(0, 12).map((c) => ({ key: `c-${c.id}`, label: `Show ${CARDS[c.type].title}`, icon: Eye, run: () => patchCard(c.id, { hidden: false }) })),
    { key: "section", label: "Add a section", icon: Plus, run: () => update((l) => ({ ...l, sections: [...l.sections, { id: newId("s"), title: "New section", style: "row", cards: [] }] })) },
    { key: "features", label: "All features", icon: LayoutGrid, run: () => setFeatures(true) },
    { key: "standard", label: "Reset to Standard", icon: LayoutDashboard, run: () => setLayout(normalize(copy(STANDARD), allow)) },
    { key: "blank", label: "Start from Blank", icon: RotateCcw, run: () => { setLayout(normalize(copy(BLANK), allow)); setTarget("mine"); } },
    { key: "default", label: "Make this the company default", icon: Star, run: makeDefault, hidden: !data.canSetDefault },
  ];

  const btn = "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{data.greeting}{data.firstName ? `, ${data.firstName}` : ""}</h1>
          {edit ? <p className="text-sm text-muted-foreground">Drag cards and sections, resize, hide or remove them. Changes save as you go.</p> : null}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="mr-auto text-xs text-muted-foreground sm:mr-0" aria-live="polite">
            {status === "saving" ? <><Loader2 className="mr-1 inline size-3 animate-spin" />Saving</> : status === "saved" ? <><Check className="mr-1 inline size-3" />Saved</> : status === "local" ? "Saved on this device" : null}
          </span>
          <button type="button" onClick={() => openAdd()} className={cn(btn, "border-border bg-transparent hover:bg-muted")}><Plus className="size-4" /> Add card</button>
          <button type="button" onClick={() => setEdit((e) => !e)} className={cn(btn, edit ? "border-transparent bg-primary text-primary-foreground hover:opacity-90" : "border-border bg-transparent hover:bg-muted")}>
            {edit ? <><Check className="size-4" /> Done</> : <><Settings2 className="size-4" /> Customize</>}
          </button>
          <RowActionsMenu label="Layout options" items={menu} />
        </div>
      </div>
      {defaultMsg ? <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{defaultMsg}</p> : null}

      {layout.template === "blank" && placed.length < 3 && !edit && (
        <section className="rounded-2xl border border-border bg-gradient-to-br from-accent/10 to-background p-5">
          <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-accent" /> Build your dashboard</p>
          <p className="mt-1 text-sm text-muted-foreground">Pick your focus to add a starter set, or tap the cards you want. You can move and resize everything later with Customize.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FOCUS.map((f) => (
              <button key={f.id} type="button" className={cn(btn, "border-accent/40 bg-accent/10 hover:bg-accent/20")}
                onClick={() => f.cards.filter(allow).filter((t) => !layout.sections.some((s) => s.cards.some((c) => c.type === t))).forEach((t) => addCard(t, "mine"))}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["my_tasks", "notifications", "mini_calendar", "weather", "notepad", "task_list", "ask_bolt", "dialpad", "stat_jobs", "chart_pipeline"] as CardType[])
              .filter(allow).filter((t) => !layout.sections.some((s) => s.cards.some((c) => c.type === t))).map((t) => {
                const m = CARDS[t];
                return <button key={t} type="button" className={cn(btn, "h-8 border-border text-xs hover:bg-muted")} onClick={() => addCard(t, layout.sections.find((s) => s.id === "mine")?.id ?? NEW_SECTION)}><m.icon className="size-3.5" /> {m.title}</button>;
              })}
            <button type="button" className={cn(btn, "h-8 border-transparent bg-primary text-xs text-primary-foreground")} onClick={() => openAdd()}><Plus className="size-3.5" /> More cards</button>
          </div>
        </section>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
        <SortableContext items={layout.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {layout.sections.map((s) => (
              <SectionView key={s.id} section={s} edit={edit} onChange={(p) => patchSection(s.id, p)} onAdd={() => openAdd(s.id)}
                onRemove={() => update((l) => ({ ...l, sections: l.sections.filter((x) => x.id !== s.id) }))}>
                {s.cards.filter((c) => edit || !c.hidden).map((c) => (
                  <CardShell key={c.id} card={c} sectionId={s.id} style={s.style} edit={edit}
                    onSize={(size) => patchCard(c.id, { size })} onHide={(hidden) => patchCard(c.id, { hidden })} onRemove={() => removeCard(c.id)}>
                    <RenderCard card={c} ctx={{ ...ctx, set: (patch) => patchCard(c.id, { settings: { ...(c.settings ?? {}), ...patch } }) }} />
                  </CardShell>
                ))}
              </SectionView>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeCard ? <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-lg">{CARDS[activeCard.type].title}</div> : null}
        </DragOverlay>
      </DndContext>

      {edit && (
        <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-muted"
          onClick={() => update((l) => ({ ...l, sections: [...l.sections, { id: newId("s"), title: "New section", style: "row", cards: [] }] }))}>
          <Plus className="size-4" /> Add a section
        </button>
      )}

      <AddCardPanel open={adding} onOpenChange={setAdding} layout={layout} target={target} onTarget={setTarget} onAdd={(t) => addCard(t)} onShow={showCard} allowed={allow} />
      <FeatureMenu open={features} onOpenChange={setFeatures} role={data.role} flags={data.flags} appUrl={data.appUrl} />
    </div>
  );
}
