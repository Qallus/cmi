"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFabHidden } from "@/lib/ui/fab-preference";

/**
 * Show/hide the floating Quick Actions button. The preference is per browser,
 * the same way the theme is, so hiding it on a laptop doesn't hide it on the
 * office machine.
 */
export function FabVisibility() {
  const [hidden, setHidden] = useFabHidden();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        The round Quick Actions button in the bottom-right corner opens notes, requests and direct messages.
        Hide it when it covers the last row of a long list.
      </p>

      <div role="radiogroup" aria-label="Quick Actions button" className="flex gap-2">
        {[
          { value: false, label: "Show", icon: Eye, hint: "Always visible" },
          { value: true, label: "Hide", icon: EyeOff, hint: "Out of the way" },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={hidden === opt.value}
            onClick={() => setHidden(opt.value)}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition",
              hidden === opt.value
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            <opt.icon className="h-4 w-4 shrink-0" />
            <span>
              <span className="block font-medium">{opt.label}</span>
              <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Saved in this browser. You can also hide it from the button itself.
      </p>
    </div>
  );
}
