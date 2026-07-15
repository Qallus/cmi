import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function selectOptionsFromChildren(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    if (child.type !== "option") return [];
    const value = String(child.props.value ?? child.props.children ?? "");
    const label = React.Children.toArray(child.props.children).join("");
    return [{ value, label, disabled: child.props.disabled }];
  });
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function parseDate(value?: string | number | readonly string[]) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTime(value?: string | number | readonly string[]) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(value?: string) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "Select date";
}

function formatDateTimeLabel(value?: string) {
  const date = parseDateTime(value);
  return date ? date.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Select date and time";
}

function monthDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  if (type === "date") {
    return <DateInput className={className} {...props} />;
  }
  if (type === "datetime-local") {
    return <DateTimeInput className={className} {...props} />;
  }

  return (
    <input
      className={cn("cmi-form-control h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-ring", className)}
      type={type}
      {...props}
    />
  );
}

function DateTimeInput({
  className,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  id,
  placeholder,
  ..._props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = React.useId();
  const controlId = id || generatedId;
  const isControlled = value !== undefined;
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(String(defaultValue ?? ""));
  const selectedValue = String(isControlled ? value ?? "" : internalValue);
  const selectedDateTime = parseDateTime(selectedValue);
  const [visibleMonth, setVisibleMonth] = React.useState(() => selectedDateTime || new Date());
  const [hour, setHour] = React.useState(() => {
    const date = selectedDateTime || new Date();
    const next = date.getHours() % 12 || 12;
    return String(next).padStart(2, "0");
  });
  const [minute, setMinute] = React.useState(() => String((selectedDateTime || new Date()).getMinutes()).padStart(2, "0"));
  const [period, setPeriod] = React.useState<"AM" | "PM">(() => (selectedDateTime && selectedDateTime.getHours() >= 12 ? "PM" : "AM"));
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const today = dateOnly(new Date());

  React.useEffect(() => {
    if (!selectedDateTime) return;
    setVisibleMonth(selectedDateTime);
    setHour(String(selectedDateTime.getHours() % 12 || 12).padStart(2, "0"));
    setMinute(String(selectedDateTime.getMinutes()).padStart(2, "0"));
    setPeriod(selectedDateTime.getHours() >= 12 ? "PM" : "AM");
  }, [selectedValue]);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const choose = (dayValue?: string, nextHour = hour, nextMinute = minute, nextPeriod = period, close = false) => {
    const datePart = dayValue || (selectedValue ? selectedValue.slice(0, 10) : dateOnly(visibleMonth));
    let hours = Number(nextHour);
    if (nextPeriod === "PM" && hours < 12) hours += 12;
    if (nextPeriod === "AM" && hours === 12) hours = 0;
    const next = `${datePart}T${String(hours).padStart(2, "0")}:${String(Number(nextMinute)).padStart(2, "0")}`;
    if (!isControlled) setInternalValue(next);
    if (close) setOpen(false);
    onChange?.({
      target: { value: next, name },
      currentTarget: { value: next, name }
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const moveMonth = (amount: number) => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const days = monthDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const hourOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
  const minuteOptions = ["00", "15", "30", "45"];

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        id={controlId}
        type="button"
        disabled={disabled}
        className="cmi-form-control flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm text-foreground outline-none transition hover:border-accent focus:border-accent focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span className={cn("truncate", !selectedValue && "text-muted-foreground")}>{selectedValue ? formatDateTimeLabel(selectedValue) : placeholder || "Select date and time"}</span>
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 grid w-[470px] max-w-[calc(100vw-2rem)] grid-cols-[1fr_176px] overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-lg">
          <div className="p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">{monthLabel}</div>
              <div className="flex items-center gap-1">
                <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" onClick={() => moveMonth(-1)} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" onClick={() => moveMonth(1)} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => <div key={day} className="py-1">{day}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map(day => {
                const dayValue = dateOnly(day);
                const isSelected = dayValue === selectedValue.slice(0, 10);
                const isToday = dayValue === today;
                const isMuted = day.getMonth() !== visibleMonth.getMonth();
                return (
                  <button
                    key={dayValue}
                    type="button"
                    className={cn(
                      "grid h-8 place-items-center rounded-md text-sm outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      isMuted && "text-muted-foreground",
                      isToday && "border border-accent",
                      isSelected && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => choose(dayValue)}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <button type="button" className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => { if (!isControlled) setInternalValue(""); onChange?.({ target: { value: "", name }, currentTarget: { value: "", name } } as React.ChangeEvent<HTMLInputElement>); }}>
                Clear
              </button>
              <button type="button" className="rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-accent hover:text-accent-foreground" onClick={() => {
                const now = new Date();
                const next = dateTimeLocalValue(now);
                if (!isControlled) setInternalValue(next);
                setVisibleMonth(now);
                onChange?.({ target: { value: next, name }, currentTarget: { value: next, name } } as React.ChangeEvent<HTMLInputElement>);
              }}>
                Today
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 border-l border-border bg-muted/30 p-3">
            <TimeColumn values={hourOptions} value={hour} onSelect={next => { setHour(next); choose(undefined, next, minute, period); }} />
            <TimeColumn values={minuteOptions} value={minute} onSelect={next => { setMinute(next); choose(undefined, hour, next, period); }} />
            <TimeColumn values={["AM", "PM"]} value={period} onSelect={next => { const nextPeriod = next as "AM" | "PM"; setPeriod(nextPeriod); choose(undefined, hour, minute, nextPeriod); }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimeColumn({ values, value, onSelect }: { values: string[]; value: string; onSelect: (value: string) => void }) {
  return (
    <div className="cmi-time-scroll max-h-[292px] space-y-1 overflow-y-auto pr-1.5">
      {values.map(item => (
        <button
          key={item}
          type="button"
          className={cn("grid h-8 w-full place-items-center rounded-md px-1 text-sm tabular-nums transition hover:bg-accent hover:text-accent-foreground", item === value && "bg-accent text-accent-foreground")}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function DateInput({
  className,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  id,
  placeholder,
  ..._props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = React.useId();
  const controlId = id || generatedId;
  const isControlled = value !== undefined;
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(String(defaultValue ?? ""));
  const selectedValue = String(isControlled ? value ?? "" : internalValue);
  const selectedDate = parseDate(selectedValue);
  const [visibleMonth, setVisibleMonth] = React.useState(() => selectedDate || new Date());
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const today = dateOnly(new Date());

  React.useEffect(() => {
    if (selectedDate) setVisibleMonth(selectedDate);
  }, [selectedValue]);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const choose = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue);
    setOpen(false);
    onChange?.({
      target: { value: nextValue, name },
      currentTarget: { value: nextValue, name }
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const moveMonth = (amount: number) => {
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const goToday = () => {
    const next = dateOnly(new Date());
    setVisibleMonth(new Date(`${next}T00:00:00`));
    choose(next);
  };

  const days = monthDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        id={controlId}
        type="button"
        disabled={disabled}
        className="cmi-form-control flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm text-foreground outline-none transition hover:border-accent focus:border-accent focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span className={cn("truncate", !selectedValue && "text-muted-foreground")}>{selectedValue ? formatDateLabel(selectedValue) : placeholder || "Select date"}</span>
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[292px] rounded-md border border-border bg-card p-3 text-card-foreground shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">{monthLabel}</div>
            <div className="flex items-center gap-1">
              <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" onClick={() => moveMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" onClick={() => moveMonth(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => <div key={day} className="py-1">{day}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map(day => {
              const dayValue = dateOnly(day);
              const isSelected = dayValue === selectedValue;
              const isToday = dayValue === today;
              const isMuted = day.getMonth() !== visibleMonth.getMonth();
              return (
                <button
                  key={dayValue}
                  type="button"
                  className={cn(
                    "grid h-8 place-items-center rounded-md text-sm outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    isMuted && "text-muted-foreground",
                    isToday && "border border-accent",
                    isSelected && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => choose(dayValue)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <button type="button" className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => choose("")}>
              Clear
            </button>
            <button type="button" className="rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-accent hover:text-accent-foreground" onClick={goToday}>
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  id,
  ..._props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const options = React.useMemo(() => selectOptionsFromChildren(children), [children]);
  const generatedId = React.useId();
  const controlId = id || generatedId;
  const isControlled = value !== undefined;
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(String(defaultValue ?? options[0]?.value ?? ""));
  const selectedValue = String(isControlled ? value : internalValue);
  const selected = options.find(option => option.value === selectedValue) || options[0];
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  React.useEffect(() => {
    if (!isControlled && !internalValue && options[0]) setInternalValue(options[0].value);
  }, [internalValue, isControlled, options]);

  const choose = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue);
    setOpen(false);
    onChange?.({
      target: { value: nextValue, name },
      currentTarget: { value: nextValue, name }
    } as React.ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        id={controlId}
        type="button"
        disabled={disabled}
        className="cmi-form-control flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm text-foreground outline-none transition hover:border-accent focus:border-accent focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        onKeyDown={event => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="truncate">{selected?.label || "Select..."}</span>
        <span className="text-muted-foreground" aria-hidden="true">v</span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-labelledby={controlId}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-auto rounded-md border border-border bg-card p-1 text-card-foreground shadow-lg"
        >
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              disabled={option.disabled}
              className={cn(
                "flex min-h-8 w-full items-center rounded px-3 text-left text-sm outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
                option.value === selectedValue && "bg-accent text-accent-foreground"
              )}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn("cmi-form-control min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-ring", className)}
      {...props}
    />
  );
}
