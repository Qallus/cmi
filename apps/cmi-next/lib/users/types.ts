export type UserRole =
  | "super_admin"
  | "admin"
  | "project_manager"
  | "staff"
  | "designer"
  | "estimator"
  | "superintendent"
  | "subcontractor"
  | "vendor"
  | "client"
  | "viewer";

export type UserStatus = "active" | "invited" | "pending" | "disabled" | "removed" | "suspended" | "archived";

export type ManagedUser = {
  id: string;
  auth_user_id: string | null;
  contact_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string | null;
  role_slug: UserRole;
  status: UserStatus;
  company_name: string | null;
  job_title: string | null;
  title: string | null;
  avatar_url: string | null;
  notes: string | null;
  invited_at: string | null;
  invite_email_sent_at: string | null;
  invite_sms_sent_at: string | null;
  invite_accepted_at: string | null;
  disabled_at: string | null;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type UserActivity = {
  id: string;
  user_id: string | null;
  action: string;
  description: string | null;
  created_at: string;
};

export type UsersData = {
  users: ManagedUser[];
  activities: UserActivity[];
};

export type UserInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role_slug: UserRole;
  status: UserStatus;
  company_name?: string;
  job_title?: string;
  avatar_url?: string;
  notes?: string;
  send_invite?: boolean;
  notify_sms?: boolean;
};
