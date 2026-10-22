"use client";

// Reload /oauth/authorize once from our own origin so the browser includes the
// SameSite=strict session cookie (see page.tsx). `_b=1` stops a loop.
import * as React from "react";
import { Loader2 } from "lucide-react";

export function SessionBounce() {
  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("_b", "1");
    window.location.replace(url.toString());
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Checking your CMI sign-in…
    </div>
  );
}
