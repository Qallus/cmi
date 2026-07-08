import type { JobWithRelations } from "./types";

// Resolve the primary client contact for a job (used to address PDFs / emails).
export function primaryClient(job: JobWithRelations): { name: string; email: string | null; phone: string | null } | null {
  const jc = job.contacts.find((c) => c.is_primary && c.contact) ?? job.contacts.find((c) => c.contact);
  if (!jc?.contact) return null;
  return {
    name: `${jc.contact.first_name ?? ""} ${jc.contact.last_name ?? ""}`.trim() || jc.contact.company || "Client",
    email: jc.contact.email ?? null,
    phone: jc.contact.phone ?? null,
  };
}
