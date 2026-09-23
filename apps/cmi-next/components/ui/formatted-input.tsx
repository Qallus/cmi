"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  caretForDigits, digitsBeforeCaret, formatMoney, formatPhone, moneyDigits, phoneDigits,
} from "@/lib/format/fields";

type Base = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
};

/**
 * Reformat on every keystroke without the caret drifting.
 *
 * Inserting a comma or a bracket shifts every character after it, so the
 * browser's caret — which React restores by offset — ends up in the wrong
 * place. Count the digits before the caret, reformat, then put the caret back
 * after that same digit.
 */
function useFormatted(format: (raw: string) => string, onChange: (value: string) => void) {
  const ref = React.useRef<HTMLInputElement>(null);
  const caret = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    if (caret.current === null || !ref.current) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value;
    const digits = digitsBeforeCaret(typed, e.target.selectionStart ?? typed.length);
    const formatted = format(typed);
    caret.current = caretForDigits(formatted, digits);
    onChange(formatted);
  };

  return { ref, handle };
}

/**
 * A phone field that formats to (480) 352-7598 as it's typed.
 *
 * It stores the formatted string, which is what everything that reads a phone
 * number here expects to display. Sending strips the punctuation anyway —
 * see normalizePhone in lib/twilio.ts.
 */
export function PhoneInput({ value, onChange, className, placeholder, ...rest }: Base) {
  const { ref, handle } = useFormatted(formatPhone, onChange);
  return (
    <Input
      {...rest}
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      className={className}
      placeholder={placeholder ?? "(480) 352-7598"}
      value={formatPhone(value ?? "")}
      onChange={handle}
    />
  );
}

/** The digits behind a formatted phone number, for storing or sending. */
export { phoneDigits };

/**
 * A money field that groups with commas as it's typed.
 *
 * `value` and `onChange` carry the display string ("1,250,000"). Read it back
 * with `moneyValue` wherever a number is needed — the commas are not for the
 * database.
 */
export function MoneyInput({ value, onChange, className, placeholder, ...rest }: Base) {
  const { ref, handle } = useFormatted(formatMoney, onChange);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn("pl-7", className)}
        placeholder={placeholder ?? "0"}
        value={formatMoney(value ?? "")}
        onChange={handle}
      />
    </div>
  );
}

/** The number behind a formatted money string; null when there isn't one. */
export function moneyValue(value: string | null | undefined): number | null {
  const raw = moneyDigits(String(value ?? ""));
  if (raw === "" || raw === ".") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
