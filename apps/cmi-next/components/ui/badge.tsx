import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "accent" | "success" | "warning" | "danger" | "info";
};

const tones = {
  default: "border-border bg-secondary text-secondary-foreground",
  accent: "border-transparent bg-accent/15 text-accent",
  success: "border-transparent bg-success/15 text-success",
  warning: "border-transparent bg-warning/20 text-yellow-800 dark:text-warning",
  danger: "border-transparent bg-destructive/15 text-destructive",
  info: "border-transparent bg-info/15 text-info"
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}
