"use client";

import * as React from "react";

// Currency input: shows a formatted "$105,000.00" when not focused, and the raw
// editable number while focused. Stores a clean numeric string (e.g. "105000")
// via onChange, so existing Number()/num() conversions keep working.
export function MoneyInput({
  value,
  onChange,
  className,
  placeholder,
  id,
}: {
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
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
      className={className}
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
