import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DocumentsClient } from "./documents-client";

export const metadata = { title: "Documents — CMI Dashboard" };

export type Document = {
  id: string;
  type: "contract" | "sow";
  title: string;
  client: string | null;
  client_email: string | null;
  client_phone: string | null;
  project: string | null;
  location: string | null;
  date: string | null;
  start_date: string | null;
  completion_date: string | null;
  value: string | null;
  deposit: string | null;
  payment_schedule: string | null;
  payment_terms: string | null;
  services: string | null;
  description: string | null;
  deliverables: string | null;
  exclusions: string | null;
  assumptions: string | null;
  warranty: string | null;
  change_order: string | null;
  dispute: string | null;
  permits: string | null;
  roc: string | null;
  cmi_rep: string | null;
  prepared_by: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

async function loadDocuments(): Promise<Document[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Document[];
}

export default async function DocumentsPage() {
  try {
    const docs = await loadDocuments();
    return <DocumentsClient initialDocs={docs} />;
  } catch {
    return <DocumentsClient initialDocs={[]} />;
  }
}
