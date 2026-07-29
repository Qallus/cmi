// Bolt training documents — a lightweight knowledge base injected into Bolt's
// system prompt so uploaded guidance actually influences its answers.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type TrainingDoc = {
  id: string;
  title: string;
  content: string;
  source_name: string | null;
  file_path: string | null;
  enabled: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

// Cap how much training text we inject so the system prompt stays sane.
const MAX_CONTEXT_CHARS = 24_000;
const MAX_DOC_CHARS = 8_000;

/**
 * Build the training-knowledge block for the system prompt from enabled docs.
 * Returns "" when there is nothing enabled, so callers can append unconditionally.
 */
export async function loadTrainingContext(): Promise<string> {
  const { data } = await getSupabaseAdmin()
    .from("bolt_training_docs")
    .select("title, content")
    .eq("enabled", true)
    .order("created_at", { ascending: true });

  const docs = (data ?? []).filter((d) => (d.content ?? "").trim());
  if (docs.length === 0) return "";

  const parts: string[] = [];
  let total = 0;
  for (const d of docs) {
    const body = String(d.content).trim().slice(0, MAX_DOC_CHARS);
    const block = `### ${d.title || "Untitled"}\n${body}`;
    if (total + block.length > MAX_CONTEXT_CHARS) break;
    parts.push(block);
    total += block.length;
  }
  if (parts.length === 0) return "";

  return [
    "\n\nCMI KNOWLEDGE BASE (uploaded by staff to train you — treat as authoritative CMI guidance; prefer it over general knowledge when relevant):",
    ...parts,
  ].join("\n\n");
}
