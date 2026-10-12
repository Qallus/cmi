export type DailyLog = {
  id: string;
  /** One of job_id / opportunity_id is always set. */
  job_id: string | null;
  /** Set when the log is for Pre-Con work rather than a Job. */
  opportunity_id: string | null;
  log_date: string;
  title: string | null;
  notes: string | null;
  weather: string | null;
  temperature: string | null;
  hours_worked: number | null;
  crew: string[] | null;
  visitors: string | null;
  delays: string | null;
  photos: string[] | null;
  /** Voice notes and other non-photo files: [{ url, type, name }]. */
  attachments: { url: string; type: string; name?: string | null }[] | null;
  client_visible: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyLogDraft = Partial<Omit<DailyLog, "id" | "created_at" | "updated_at">> & { log_date: string };
