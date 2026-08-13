import { notFound, redirect } from "next/navigation";
import { WorkspaceEditor } from "@/components/workspace/workspace-editor";
import { getCurrentProfile } from "@/lib/workspace/auth";
import { can, PERMISSIONS } from "@/lib/workspace/auth";
import { getDocument, listDocuments, listFolders, DEFAULT_WORKSPACE_ID } from "@/lib/workspace/repository";
import { listComments, listMentionableUsers } from "@/lib/workspace/comments";

export const dynamic = "force-dynamic";

export default async function WorkspaceDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=/dashboard/workspace/${id}`);
  if (!can(profile.role, PERMISSIONS.MANAGE_WORKSPACE)) redirect("/dashboard/overview");

  const doc = await getDocument(id, profile.id);
  if (!doc) notFound();
  const workspaceId = (doc as any).workspace_id ?? DEFAULT_WORKSPACE_ID;

  const [{ mine, shared }, folders, comments, mentionable] = await Promise.all([
    listDocuments(profile.id, workspaceId),
    listFolders(profile.id, workspaceId),
    listComments(id),
    listMentionableUsers(),
  ]);

  const navDocs = [...mine, ...shared].map((d) => ({ id: d.id, title: d.title, is_favorite: d.is_favorite, folder_name: d.folder_name }));

  return (
    <WorkspaceEditor
      doc={{ id: doc.id, title: doc.title, content_json: doc.content_json, scope: doc.scope, updated_at: doc.updated_at }}
      navDocs={navDocs}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      comments={comments}
      mentionable={mentionable}
      workspaceId={workspaceId}
    />
  );
}
