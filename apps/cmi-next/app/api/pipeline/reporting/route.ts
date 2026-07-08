// Pipeline reporting: conversion rates, pipeline value, loss analysis,
// long-lead follow-ups. Leads (for the Lead→Opportunity rate) are counted from
// the CRM: contacts with type 'Lead' plus open quotes.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadOpportunities, loadStageHistory } from "@/lib/pipeline/data";
import { computeReport } from "@/lib/pipeline/reporting";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const [opps, history] = await Promise.all([loadOpportunities(), loadStageHistory()]);

    // Lead pool = CRM leads + open quotes (best-effort; failures fall back to null rate).
    let leadCount: number | undefined;
    try {
      const sb = getSupabaseAdmin();
      const [{ count: contactLeads }, { count: openQuotes }] = await Promise.all([
        sb.from("contacts").select("id", { count: "exact", head: true }).eq("type", "Lead"),
        sb.from("quotes").select("id", { count: "exact", head: true }).in("status", ["New", "In Review", "Quoted"]),
      ]);
      leadCount = (contactLeads ?? 0) + (openQuotes ?? 0);
    } catch { leadCount = undefined; }

    return NextResponse.json(computeReport(opps, history, leadCount));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
