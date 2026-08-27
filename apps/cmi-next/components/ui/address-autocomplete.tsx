"use client";

import * as React from "react";
import { MapPin, Loader2 } from "lucide-react";

export type AddressPick = { street: string; city: string; state: string; zip: string };
type Suggestion = AddressPick & { label: string };

// Street-address input with keyless autocomplete (OpenStreetMap via our proxy).
// The user types a street; picking a suggestion fills street/city/state/zip.
export function AddressAutocomplete({
  value,
  onChange,
  onPick,
  className,
  placeholder,
  id,
}: {
  value: string;
  onChange: (street: string) => void;
  onPick: (a: AddressPick) => void;
  className?: string;
  placeholder?: string;
  id?: string;
}) {
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const skipNext = React.useRef(false);

  // Debounced lookup as the user types.
  React.useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = value.trim();
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/geocode/autocomplete?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { suggestions?: Suggestion[] }) => {
          if (cancelled) return;
          setSuggestions(d.suggestions ?? []);
          setOpen((d.suggestions ?? []).length > 0);
          setActive(-1);
        })
        .catch(() => { if (!cancelled) setSuggestions([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(s: Suggestion) {
    skipNext.current = true; // don't re-search for the value we just set
    onPick({ street: s.street || value, city: s.city, state: s.state, zip: s.zip });
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        className={className}
        value={value}
        placeholder={placeholder ?? "Start typing an address…"}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(suggestions[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-xl">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition ${i === active ? "bg-accent/10 text-accent" : "hover:bg-muted"}`}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{s.street || s.city || s.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[s.city, s.state, s.zip].filter(Boolean).join(", ")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
