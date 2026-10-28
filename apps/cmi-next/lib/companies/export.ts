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
