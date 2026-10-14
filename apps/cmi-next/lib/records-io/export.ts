// CSV export + import templates for Pre-Con and Jobs (browser-only).
// Headers use the field labels, which the importer matches back, so an
// exported file can be edited and re-imported.
import { downloadCsv, toCsv } from "@/lib/csv";
import type { Opportunity } from "@/lib/pipeline/types";
import type { JobListRow } from "@/lib/jobs/data";
import { FIELDS, type RecordTarget } from "./fields";

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportPreconCsv(rows: Opportunity[]) {
  const specs = FIELDS.precon.filter((f) => !f.key.startsWith("client_"));
  const headers = [...specs.map((f) => f.label), "Created", "Updated"];
  const data = rows.map((o) => {
    const rec = o as unknown as Record<string, unknown>;
    return [...specs.map((f) => rec[f.key]), o.created_at?.slice(0, 10), o.updated_at?.slice(0, 10)];
  });
  downloadCsv(`cmi-precon-${stamp()}.csv`, toCsv(headers, data));
}

export function exportJobsCsv(rows: JobListRow[]) {
  const specs = FIELDS.jobs.filter((f) => f.key !== "client_email");
  // "Client Name" holds the primary client so a re-import links one contact;
  // "All Clients" lists everyone on the job.
  const headers = [...specs.map((f) => f.label), "All Clients", "Lead #", "Created", "Updated"];
  const data = rows.map((j) => {
    const rec = j as unknown as Record<string, unknown>;
    return [
      ...specs.map((f) => {
        if (f.key === "job_type") return j.type_name;
        if (f.key === "client_name") return j.clients[0]?.name;
        if (f.key === "client_phone") return j.clients[0]?.phone;
        return rec[f.key];
      }),
      j.clients.map((c) => c.name).join("; "), j.lead_number, j.created_at?.slice(0, 10), j.updated_at?.slice(0, 10),
    ];
  });
  downloadCsv(`cmi-jobs-${stamp()}.csv`, toCsv(headers, data));
}

const EXAMPLE: Record<RecordTarget, Record<string, string>> = {
  precon: {
    opportunity_name: "26_030_Lillie Residence", stage: "Pre-Construction / Design", project_type: "remodel",
    project_address: "3010 North Marigold Drive", city: "Phoenix", state: "AZ", zip_code: "85018",
    client_name: "Trisha Lillie", client_email: "client@example.com", estimated_project_value: "400000",
    notes: "Kitchen, primary bathroom, and broader home improvements.",
  },
  jobs: {
    job_name: "Smith Residence", job_number: "25_062", status: "Active Project", job_type: "Residential",
    contract_type: "fixed_price", contract_price: "350000", street_address: "123 Main St", city: "Scottsdale",
    state: "AZ", zip_code: "85251", client_name: "Jane Smith", client_email: "client@example.com",
    projected_start_date: "2026-11-01", internal_notes: "Whole-home remodel.",
  },
};

export function downloadTemplate(target: RecordTarget) {
  const specs = FIELDS[target];
  downloadCsv(
    `cmi-${target === "precon" ? "precon" : "jobs"}-import-template.csv`,
    toCsv(specs.map((f) => f.label), [specs.map((f) => EXAMPLE[target][f.key] ?? "")]),
  );
}
