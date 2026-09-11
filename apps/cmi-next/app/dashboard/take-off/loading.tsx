export default function TakeOffLoading() {
  return (
    <section className="space-y-5 p-6" aria-busy="true" aria-label="Loading Take-Off">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-lg border border-border bg-card" />
      <div className="h-[560px] animate-pulse rounded-lg border border-border bg-muted" />
      <p className="text-sm text-muted-foreground">Loading Take-Off…</p>
    </section>
  );
}
