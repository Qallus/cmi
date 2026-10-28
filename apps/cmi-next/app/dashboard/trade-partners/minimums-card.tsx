"use client";

// Trade Partners → Setup → Insurance minimums. A default set, plus overrides
// for a partner type or a trade. An override can raise, lower or switch off a
// line; when a partner matches several (their type and each trade), the
// strictest applies. The application form, the Become a Trade Partner page
// and Claude's certificate check all read this.
import * as React from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TRADES } from "@/lib/prequal/form";
import {
  COVERAGE_KEYS, COVERAGE_LABEL, minimumText, resolveMinimums,
  type CoverageKey, type MinimumLine, type MinimumsOverride, type MinimumsSettings,
} from "@/lib/prequal/coverage";

const PARTNER_TYPES = ["Subcontractor", "Supplier / Vendor", "Consultant", "Designer", "Architect", "Engineer", "Other"];

/** Which amounts each line asks for, in insurance terms. */
const AMOUNTS: Record<CoverageKey, { k: "perOccurrence" | "aggregate"; label: string }[]> = {
  gl: [{ k: "perOccurrence", label: "Each occurrence" }, { k: "aggregate", label: "Aggregate" }],
  auto: [{ k: "perOccurrence", label: "Combined single limit" }],
  wc: [{ k: "perOccurrence", label: "Employer's liability" }],
  umbrella: [{ k: "perOccurrence", label: "Each occurrence" }],
};

type Rule = { kind: "type" | "trade"; name: string; lines: MinimumsOverride };

const toRules = (m: MinimumsSettings): Rule[] => [
  ...Object.entries(m.byPartnerType).map(([name, lines]) => ({ kind: "type" as const, name, lines })),
  ...Object.entries(m.byTrade).map(([name, lines]) => ({ kind: "trade" as const, name, lines })),
];

function MoneyField({ value, disabled, onChange, label }: { value: number | null | undefined; disabled?: boolean; onChange: (n: number | null) => void; label: string }) {
  const [text, setText] = React.useState(value != null ? value.toLocaleString("en-US") : "");
  React.useEffect(() => { setText(value != null ? value.toLocaleString("en-US") : ""); }, [value]);
  return (
    <label className="block text-[11px] text-muted-foreground">
      {label}
      <div className="relative mt-0.5">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <Input value={text} disabled={disabled} inputMode="numeric" className="h-8 w-36 pl-5 text-sm" placeholder="0"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { const n = Number(text.replace(/[^\d]/g, "")); onChange(text.trim() ? (Number.isFinite(n) ? n : null) : null); }} />
      </div>
    </label>
  );
}

/** One coverage line's editor: required (or inherit, for overrides) and amounts. */
function LineEditor({ k, line, disabled, override, onChange }: {
  k: CoverageKey; line: MinimumLine | undefined; disabled: boolean; override?: boolean; onChange: (l: MinimumLine | undefined) => void;
}) {
  const mode = !line ? "inherit" : line.required ? "required" : "off";
  return (
    <div className="flex flex-wrap items-end gap-3 py-2">
      <div className="w-44">
        <p className="text-sm font-medium">{COVERAGE_LABEL[k]}</p>
        <Select value={mode} disabled={disabled} className="mt-0.5 w-44 [&>button]:h-8"
          onChange={(e) => onChange(e.target.value === "inherit" ? undefined : e.target.value === "off" ? { required: false } : { required: true, perOccurrence: line?.perOccurrence ?? null, aggregate: line?.aggregate ?? null })}>
          {override && <option value="inherit">Same as default</option>}
          <option value="required">Required</option>
          <option value="off">Not required</option>
        </Select>
      </div>
      {line?.required && AMOUNTS[k].map((a) => (
        <MoneyField key={a.k} label={a.label} value={line[a.k]} disabled={disabled} onChange={(n) => onChange({ ...line, [a.k]: n })} />
      ))}
      {line?.required && <p className="pb-1.5 text-xs text-muted-foreground">{minimumText(k, line)}</p>}
    </div>
  );
}

export function MinimumsCard({ canDecide }: { canDecide: boolean }) {
  const [settings, setSettings] = React.useState<MinimumsSettings | null>(null);
  const [rules, setRules] = React.useState<Rule[]>([]);
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [tryType, setTryType] = React.useState("Subcontractor");
  const [tryTrade, setTryTrade] = React.useState("");

  React.useEffect(() => {
    void fetch("/api/trade-partners/minimums").then((r) => r.json()).then((j) => {
      if (j.minimums) { setSettings(j.minimums); setRules(toRules(j.minimums)); }
    });
  }, []);

  const current: MinimumsSettings | null = settings && {
    default: settings.default,
    byPartnerType: Object.fromEntries(rules.filter((r) => r.kind === "type" && r.name).map((r) => [r.name, r.lines])),
    byTrade: Object.fromEntries(rules.filter((r) => r.kind === "trade" && r.name).map((r) => [r.name, r.lines])),
  };
  const edit = (fn: () => void) => { fn(); setState("idle"); };

  async function save() {
    if (!current) return;
    setState("saving"); setError(null);
    const res = await fetch("/api/trade-partners/minimums", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minimums: current }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setState("error"); setError(json.error ?? "Couldn't save."); return; }
    setSettings(json.minimums); setRules(toRules(json.minimums)); setState("saved");
  }

  if (!settings || !current) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">Insurance minimums</h2>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      </section>
    );
  }

  const example = resolveMinimums(current, { partnerType: tryType, trades: tryTrade ? [tryTrade] : [] });
  const usedTypes = new Set(rules.filter((r) => r.kind === "type").map((r) => r.name));
  const usedTrades = new Set(rules.filter((r) => r.kind === "trade").map((r) => r.name));

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Insurance minimums</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What trade partners must carry. Used on the application, the Become a Trade Partner page, and when Claude checks certificates.
          </p>
        </div>
        {canDecide && (
          <Button size="sm" variant="accent" disabled={state === "saving"} onClick={() => void save()}>
            {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {state === "saved" ? "Saved" : "Save"}
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Default (everyone)</h3>
      <div className="divide-y divide-border">
        {COVERAGE_KEYS.map((k) => (
          <LineEditor key={k} k={k} line={current.default[k]} disabled={!canDecide}
            onChange={(l) => edit(() => setSettings({ ...settings, default: { ...settings.default, [k]: l ?? { required: false } } }))} />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Different by category</h3>
        {canDecide && (
          <Button size="sm" variant="outline" onClick={() => edit(() => setRules([...rules, { kind: "trade", name: "", lines: {} }]))}>
            <Plus className="h-3.5 w-3.5" /> Add a category
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        For a partner type or a trade, set any line higher, lower or not required. A partner who matches several (their type and each of their trades) gets the strictest.
      </p>
      {rules.length === 0 && <p className="mt-3 rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">No categories yet — everyone uses the default.</p>}
      <div className="mt-3 space-y-3">
        {rules.map((r, i) => (
          <div key={i} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={r.kind} disabled={!canDecide} className="w-36 [&>button]:h-8"
                onChange={(e) => edit(() => setRules(rules.map((x, j) => (j === i ? { ...x, kind: e.target.value as Rule["kind"], name: "" } : x))))}>
                <option value="trade">Trade</option>
                <option value="type">Partner type</option>
              </Select>
              <Select value={r.name} disabled={!canDecide} className="w-56 [&>button]:h-8"
                onChange={(e) => edit(() => setRules(rules.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))))}>
                <option value="">Choose…</option>
                {(r.kind === "type" ? PARTNER_TYPES : [...TRADES]).filter((n) => n === r.name || !(r.kind === "type" ? usedTypes : usedTrades).has(n))
                  .map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
              {canDecide && (
                <Button size="sm" variant="ghost" className="ml-auto text-destructive" aria-label="Remove category"
                  onClick={() => edit(() => setRules(rules.filter((_, j) => j !== i)))}><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
            <div className="mt-1 divide-y divide-border">
              {COVERAGE_KEYS.map((k) => (
                <LineEditor key={k} k={k} line={r.lines[k]} override disabled={!canDecide}
                  onChange={(l) => edit(() => setRules(rules.map((x, j) => {
                    if (j !== i) return x;
                    const lines = { ...x.lines };
                    if (l) lines[k] = l; else delete lines[k];
                    return { ...x, lines };
                  })))} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-md bg-muted/40 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">Check a partner:</span>
          <Select value={tryType} onChange={(e) => setTryType(e.target.value)} className="w-44 [&>button]:h-8">
            {PARTNER_TYPES.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <Select value={tryTrade} onChange={(e) => setTryTrade(e.target.value)} className="w-48 [&>button]:h-8">
            <option value="">Any trade</option>
            {TRADES.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <ul className="mt-2 space-y-0.5 text-xs">
          {COVERAGE_KEYS.map((k) => (
            <li key={k} className="flex flex-wrap justify-between gap-2">
              <span>{example[k].label}</span>
              <span className={example[k].required ? "font-medium" : "text-muted-foreground"}>
                {example[k].text}{example[k].source !== "Default" ? ` (${example[k].source})` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
