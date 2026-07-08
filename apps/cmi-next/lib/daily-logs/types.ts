export type DailyLog = {
  id: string;
  job_id: string;
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
  client_visible: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyLogDraft = Partial<Omit<DailyLog, "id" | "created_at" | "updated_at">> & { log_date: string };
