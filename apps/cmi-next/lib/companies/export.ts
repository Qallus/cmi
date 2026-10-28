// Trade partner list for Excel (audits, 1099s, bid packages): company,
// business structure, trades with CMI cost codes, contacts by role, and the
// status and expiration of each compliance document. CSV with a UTF-8 BOM so
// Excel opens it with the right characters. Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { costCodeMap } from "@/lib/prequal/trades";
import type { Company } from "./data";

const ROLES = ["primary", "accounting", "estimating", "field", "emergency"] as const;
const DOCS = [["w9", "W-9"], ["coi", "COI"], ["license", "License"], ["msa", "MSA"]] as const;

/** Corporations are usually exempt from 1099-NEC; everyone else usually isn't. Verify on the W-9. */
function form1099(structure: string | null): string {
  if (!structure) return "";
  return /corporation/i.test(structure) ? "Usually exempt (verify W-9)" : "Usually required (verify W-9)";
}

export async function tradePartnerCsv(opts: { includeHidden?: boolean } = {}): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("companies").select("*").is("archived_at", null).order("name").limit(5000);
  let companies = (data ?? []) as (Company & Record<string, unknown>)[];
  if (!opts.includeHidden) companies = companies.filter((c) => !!c.partner_type || c.qualification_status !== "prospect");
  const ids = companies.map((c) => c.id);

  const [{ data: contacts }, { data: docs }, codes] = await Promise.all([
    ids.length ? supabase.from("contacts").select("company_id, first_name, last_name, email, phone, company_roles").in("company_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("company_documents").select("company_id, doc_type, status, expires_on").in("company_id", ids) : Promise.resolve({ data: [] }),
    costCodeMap(),
  ]);

  const byCompany = <T extends { company_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.company_id, [...(m.get(r.company_id) ?? []), r]);
    return m;
  };
  type C = { company_id: string; first_name: string; last_name: string; email: string | null; phone: string | null; company_roles: string[] | null };
  type D = { company_id: string; doc_type: string; status: string; expires_on: string | null };
  const contactsBy = byCompany(contacts as C[]);
  const docsBy = byCompany(docs as D[]);
  const today = new Date().toISOString().slice(0, 10);

  const headers = [
    "Company", "Legal name", "Partner type", "Qualification status", "Business structure", "1099",
    "Trades", "Cost codes", "Service areas", "Office phone", "Company email", "Address",
    ...ROLES.flatMap((r) => [`${r[0].toUpperCase()}${r.slice(1)} contact`, `${r[0].toUpperCase()}${r.slice(1)} email`, `${r[0].toUpperCase()}${r.slice(1)} phone`]),
    ...DOCS.flatMap(([, label]) => [`${label} status`, `${label} expires`]),
    "Approved", "Qualification expires",
  ];

  const rows = companies.map((c) => {
    const people = contactsBy.get(c.id) ?? [];
    const roleCells = ROLES.flatMap((role) => {
      const p = people.find((x) => (x.company_roles ?? []).includes(role));
      return p ? [`${p.first_name} ${p.last_name}`.trim(), p.email ?? "", p.phone ?? ""] : ["", "", ""];
    });
    const docCells = DOCS.flatMap(([type]) => {
      const d = (docsBy.get(c.id) ?? []).find((x) => x.doc_type === type);
      if (!d) return ["Not on file", ""];
      const status = d.expires_on && d.expires_on < today ? "expired" : d.status;
      return [status, d.expires_on ?? ""];
    });
    const trades = (c.trades ?? []) as string[];
    return [
      c.name, c.legal_name ?? "", c.partner_type ?? "", c.qualification_status ?? "",
      c.business_structure ?? "", form1099(c.business_structure as string | null),
      trades.join("; ") + (c.trades_other ? ` (Other: ${c.trades_other})` : ""),
      trades.map((t) => codes.get(t)).filter(Boolean).join("; "),
      ((c.service_areas ?? []) as string[]).join("; "),
      c.phone ?? "", c.email ?? "", c.full_address ?? [c.street_address, c.city, c.state, c.zip].filter(Boolean).join(", "),
      ...roleCells, ...docCells,
      c.approved_at ? String(c.approved_at).slice(0, 10) : "", c.qualification_expires_at ?? "",
    ];
  });

  return "﻿" + toCsv(headers, rows);
}

/**
 * Master insurance tracking (brief §7.2): one row per coverage line Claude
 * read off each certificate, plus a row for any certificate not yet read, so
 * the office can sort by expiry. The Google Sheet version follows once the
 * Workspace key exists; this is the same table as a download.
 */
export async function insuranceTrackingCsv(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("company_documents")
    .select("id, doc_type, label, status, expires_on, carrier, policy_number, coverage_amount, coverages, ai_status, ai_flags, companies(name, qualification_status, archived_at)")
    .in("doc_type", ["coi", "gl", "wc", "auto", "license"]).limit(5000);
  type Row = {
    doc_type: string; label: string | null; status: string; expires_on: string | null; carrier: string | null;
    policy_number: string | null; coverage_amount: number | null; ai_status: string | null; ai_flags: string[] | null;
    coverages: { line: string; carrier: string | null; policy_number: string | null; effective_date: string | null; expiration_date: string | null;
      each_occurrence: number | null; aggregate: number | null; combined_single_limit: number | null;
      employers_liability_each_accident: number | null; meets_minimum?: boolean | null }[] | null;
    companies: { name: string; qualification_status: string | null; archived_at: string | null } | null;
  };
  const today = new Date().toISOString().slice(0, 10);
  const days = (d: string | null) => (d ? Math.round((new Date(`${d}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000) : "");
  const headers = ["Company", "Status", "Document", "Coverage", "Carrier", "Policy #", "Effective", "Expires", "Days left",
    "Each occurrence / limit", "Aggregate", "Employer's liability", "Meets minimum", "Document status", "Flags"];
  const rows: unknown[][] = [];
  for (const d of ((data ?? []) as unknown as Row[]).filter((r) => r.companies && !r.companies.archived_at)) {
    const base = [d.companies!.name, d.companies!.qualification_status ?? "", d.label || d.doc_type.toUpperCase()];
    const flags = (d.ai_flags ?? []).join(" | ");
    const status = d.expires_on && d.expires_on < today ? "expired" : d.status;
    if (d.coverages?.length) {
      for (const c of d.coverages) {
        rows.push([...base, c.line.replace(/_/g, " "), c.carrier ?? "", c.policy_number ?? "", c.effective_date ?? "",
          c.expiration_date ?? "", days(c.expiration_date), c.combined_single_limit ?? c.each_occurrence ?? "", c.aggregate ?? "",
          c.employers_liability_each_accident ?? "", c.meets_minimum == null ? "" : c.meets_minimum ? "Yes" : "No", status, flags]);
      }
    } else {
      rows.push([...base, d.ai_status === "parsed" ? "none read" : "not read yet", d.carrier ?? "", d.policy_number ?? "", "",
        d.expires_on ?? "", days(d.expires_on), d.coverage_amount ?? "", "", "", "", status, flags]);
    }
  }
  rows.sort((a, b) => String(a[7] || "9999").localeCompare(String(b[7] || "9999")));
  return "﻿" + toCsv(headers, rows);
}
