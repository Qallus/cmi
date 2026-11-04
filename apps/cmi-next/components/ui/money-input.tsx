"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Same look as <Input> unless a caller passes its own classes (merged on top).
const BASE = "cmi-form-control h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

// Currency input: shows a formatted "$105,000.00" when not focused, and the raw
// editable number while focused. Stores a clean numeric string (e.g. "105000")
// via onChange, so existing Number()/num() conversions keep working.
export function MoneyInput({
  value,
  onChange,
  className,
  placeholder,
  id,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [focused, setFocused] = React.useState(false);

  const formatted = React.useMemo(() => {
    if (value === "" || value == null) return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={cn(BASE, className)}
      disabled={disabled}
      aria-label={ariaLabel}
      value={focused ? value : formatted}
      placeholder={placeholder ?? "$0.00"}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        // Keep digits and a single decimal point only.
        const cleaned = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
        onChange(cleaned);
      }}
    />
  );
}
