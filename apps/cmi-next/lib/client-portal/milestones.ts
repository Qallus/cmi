// Client milestone page (Schedules Phase 2 / client portal). Pure wording and
// grouping so the page and tests agree. A milestone is shown when staff made
// it client-visible on a client-visible schedule and it's a Contract or Client
// decision milestone, or carries a contract date.

export type ClientMilestone = {
  id: string; title: string; type: "contract" | "client_decision" | "other";
  forecast: string | null; contract: string | null; done: boolean; doneOn: string | null;
  /** Forecast minus contract date in working days (+ = later); null without a contract date. */
  variance: number | null; schedule: string; note: string | null;
};
export type Standing = { tone: "good" | "late" | "neutral" | "done"; label: string };

const plural = (n: number, w: string) => `${n} working day${n === 1 ? "" : "s"} ${w}`;

export function standing(m: Pick<ClientMilestone, "done" | "variance" | "type">): Standing {
  if (m.done) return { tone: "done", label: "Reached" };
  if (m.variance == null) return { tone: "neutral", label: m.type === "client_decision" ? "Decision needed" : "Planned" };
  if (m.variance === 0) return { tone: "good", label: "On the contract date" };
  if (m.variance < 0) return { tone: "good", label: plural(-m.variance, "ahead") };
  return { tone: "late", label: plural(m.variance, "after the contract date") };
}

/** Upcoming first (by forecast), then the ones already reached. */
export function orderMilestones(list: ClientMilestone[]): ClientMilestone[] {
  const key = (m: ClientMilestone) => m.forecast ?? m.contract ?? "9999";
  return [...list.filter((m) => !m.done).sort((a, b) => key(a).localeCompare(key(b))), ...list.filter((m) => m.done).sort((a, b) => (b.doneOn ?? key(b)).localeCompare(a.doneOn ?? key(a)))];
}
