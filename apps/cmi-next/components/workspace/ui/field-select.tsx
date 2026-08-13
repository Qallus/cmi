"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// Thin wrapper over the branded Radix Select for the common
// "value + options" case. Radix forbids an empty-string item value, so we map
// "" <-> a reserved sentinel internally (lets callers keep an "All"/"None" option).
const EMPTY = "__empty__";

export type FieldSelectOption = { value: string; label: string };

export function FieldSelect({
  value, onChange, options, placeholder, className, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FieldSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value === "" ? EMPTY : value} onValueChange={(v) => onChange(v === EMPTY ? "" : v)} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value === "" ? EMPTY : o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
