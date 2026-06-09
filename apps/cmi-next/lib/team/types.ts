export type TeamMember = {
  id: string;
  wp_post_id: number | null;
  name: string;
  slug: string | null;
  role: string | null;
  department: string | null;
  bio: string | null;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  profile_photo: string | null;
  secondary_photo: string | null;
  attributes: string[] | null;
  availability: string | null;
  sort_order: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

export type TeamMemberDraft = Omit<TeamMember, "id" | "wp_post_id" | "created_at" | "updated_at">;
