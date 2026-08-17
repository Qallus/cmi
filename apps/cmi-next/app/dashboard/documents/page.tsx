import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import {
  listDocuments, listFolders, listWorkspaces, listHiddenTemplateIds,
  listFavoriteTemplateIds, listArchivedDocuments, DEFAULT_WORKSPACE_ID,
} from "@/lib/workspace/repository";
import { WORKSPACE_TEMPLATES } from "@/lib/workspace/templates";
import { listNotesFor } from "@/lib/notes/data";
import { isWorkspaceRole } from "@/lib/workspace/auth";
import { DocumentsClient, type WorkspaceBundle } from "./documents-client";

export const metadata = { title: "Workspace — CMI Dashboard" };

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

// Workspace (Quip/Notion-style) is open to the internal team (see WORKSPACE_ROLES).
// When the current staff has a Workspace role we hydrate the tab server-side;
// external portal roles get the standard Documents tabs without it.
async function loadWorkspaceBundle(currentWorkspaceId?: string): Promise<WorkspaceBundle | null> {
  const staff = await getSessionStaff();
  if (!staff || !isWorkspaceRole(staff.role_slug)) return null;
  try {
    const workspaces = await listWorkspaces();
    const wsId = currentWorkspaceId && workspaces.some((w) => w.id === currentWorkspaceId)
      ? currentWorkspaceId
      : (workspaces[0]?.id ?? DEFAULT_WORKSPACE_ID);
    const [{ mine, shared }, folders, hiddenTemplateIds, favoriteTemplateIds, archived, notes] = await Promise.all([
      listDocuments(staff.id, wsId),
      listFolders(staff.id, wsId),
      listHiddenTemplateIds(),
      listFavoriteTemplateIds(staff.id),
      listArchivedDocuments(staff.id, wsId),
      listNotesFor(staff.id),
    ]);
    return {
      mine, shared, folders, hiddenTemplateIds, favoriteTemplateIds, archived,
      workspaces, currentWorkspaceId: wsId,
      templates: WORKSPACE_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, category: t.category })),
      notes: notes.map((n) => ({ id: n.id, title: n.title, body: n.body, status: n.status })),
    };
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ ws?: string }> }) {
  const { ws } = await searchParams;
  const [docs, workspace] = await Promise.all([
    loadDocuments().catch(() => [] as Document[]),
    loadWorkspaceBundle(ws),
  ]);
  return <DocumentsClient initialDocs={docs} workspace={workspace} />;
}
