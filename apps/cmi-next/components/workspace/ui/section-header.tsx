type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Optional trailing element rendered inline next to the title (e.g. an info button). */
  action?: React.ReactNode;
};

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? <p className="text-xs font-semibold uppercase text-accent">{eyebrow}</p> : null}
      <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
        {action}
      </h1>
      {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
