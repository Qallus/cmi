export type JobFile = {
  id: string;
  job_id: string;
  folder: string | null;
  name: string;
  file_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  client_visible: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};
