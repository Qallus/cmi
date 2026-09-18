"use client";

import { Button } from "@/components/ui/button";

export default function ProjectionsError({ reset }: { reset: () => void }) {
  return (
    <section className="p-6" role="alert">
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Projections could not load</h1>
        <p className="text-sm text-muted-foreground">Try again. Projections never change job, invoice or pipeline records.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </section>
  );
}
