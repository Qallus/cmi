export default function ProjectionsLoading() {
  return (
    <section className="space-y-5 p-6" aria-busy="true" aria-label="Loading Projections">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-card" />)}
      </div>
      <div className="h-[480px] animate-pulse rounded-lg border border-border bg-muted" />
    </section>
  );
}
