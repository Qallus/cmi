import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Product, ProjectSelection, SelectionsData } from "./types";

function optionLabel(first: string | null, second?: string | null, fallback = "Untitled") {
  return [first, second].filter(Boolean).join(" ").trim() || fallback;
}

export async function loadSelectionsData(): Promise<SelectionsData> {
  const supabase = getSupabaseAdmin();
  const [products, selections, projects, tasks, contacts, staffUsers] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }).limit(250),
    supabase.from("project_selections").select("*").order("updated_at", { ascending: false }).limit(250),
    supabase.from("projects").select("id, title, status").order("created_at", { ascending: false }).limit(250),
    supabase.from("project_schedule_items").select("id, title, project_title, phase, project_id").order("start_date", { ascending: true }).limit(500),
    supabase.from("contacts").select("id, first_name, last_name, email, company, type").order("last_name", { ascending: true }).limit(500),
    supabase.from("staff_users").select("id, display_name, email, role_slug").order("display_name", { ascending: true }).limit(250)
  ]);

  const error = products.error || selections.error || projects.error || tasks.error || contacts.error || staffUsers.error;
  if (error) throw error;

  const contactsData = contacts.data || [];
  const contactOptions = contactsData.map(row => ({
    id: row.id,
    label: optionLabel(row.first_name, row.last_name, row.email || "Unnamed contact"),
    sublabel: [row.type, row.company].filter(Boolean).join(" / ")
  }));

  return {
    products: (products.data || []) as Product[],
    selections: (selections.data || []) as ProjectSelection[],
    projects: (projects.data || []).map(row => ({ id: row.id, label: row.title || "Untitled project", sublabel: row.status })),
    tasks: (tasks.data || []).map(row => ({
      id: row.id,
      label: row.title || "Untitled task",
      sublabel: [row.project_title, row.phase].filter(Boolean).join(" / ")
    })),
    contacts: contactOptions,
    staffUsers: (staffUsers.data || []).map(row => ({
      id: row.id,
      label: row.display_name || row.email || "Unnamed user",
      sublabel: row.role_slug
    })),
    vendors: contactOptions.filter(option => option.sublabel?.includes("Vendor")),
    subcontractors: contactOptions.filter(option => option.sublabel?.includes("Sub Contractor"))
  };
}
