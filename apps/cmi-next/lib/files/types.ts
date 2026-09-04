// Cloud file manager metadata types (bytes live in Garage).
export type FileRow = {
  id: string;
  project_id: string | null;
  job_id: string | null;
  folder_id: string | null;
  name: string;
  storage_key: string;
  thumbnail_key: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type FolderRow = {
  id: string;
  project_id: string | null;
  job_id: string | null;
  parent_id: string | null;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// Roles allowed to modify/delete files & folders they did NOT upload.
export const FILE_ADMIN_ROLES = ["super_admin", "admin"];
