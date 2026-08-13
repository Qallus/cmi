export type WorkspaceScope = "personal" | "shared";

export type WorkspaceFolder = {
  id: string;
  name: string;
  scope: WorkspaceScope;
  owner_id: string | null;
  parent_id: string | null;
  created_at: string;
};

export type WorkspaceDocListItem = {
  id: string;
  title: string;
  description: string | null;
  scope: WorkspaceScope;
  folder_id: string | null;
  folder_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  status: string;
  updated_at: string;
  updated_by_name: string | null;
  is_favorite: boolean;
};

export type WorkspaceDocument = {
  id: string;
  title: string;
  description: string | null;
  scope: WorkspaceScope;
  folder_id: string | null;
  owner_id: string | null;
  content_json: unknown;
  plain_text: string;
  status: string;
  updated_at: string;
};

/** Empty Plate value (one empty paragraph). */
export const EMPTY_DOC: unknown[] = [{ type: "p", children: [{ text: "" }] }];

/** Flatten Plate/Slate nodes to plain text (for search + previews). */
export function extractPlainText(nodes: unknown): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      if (typeof n.text === "string") out.push(n.text);
      if (Array.isArray(n.children)) n.children.forEach(walk);
    }
  };
  walk(nodes);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
