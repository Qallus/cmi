import { getSupabaseAdmin } from "@/lib/supabase/server";

// Per-job document numbering (e.g. CO-0001, INV-0001). Finds the highest numeric
// suffix already used on this job for the given column and increments it, so
// numbers stay stable and gap-tolerant (deletes don't renumber existing docs).
export async function nextJobNumber(table: string, column: string, jobId: string, prefix: string): Promise<string> {
  const { data } = await getSupabaseAdmin().from(table).select(column).eq("job_id", jobId);
  let max = 0;
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const m = String(row[column] ?? "").match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}
