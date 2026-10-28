// Read or autosave one application draft, addressed by its token.
import { NextResponse } from "next/server";
import { getByToken, saveAnswers, PrequalError } from "@/lib/prequal/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { outstandingDocuments } from "@/lib/prequal/documents";
import { REQUAL_SOURCE } from "@/lib/prequal/requalify";
import type { CompanyDocument } from "@/lib/prequal/review";
import { isFeatureEnabled } from "@/lib/flags";
import { PREQUAL_FLAG } from "@/lib/prequal/access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { token } = await params;
  const app = await getByToken(token);
  if (!app) return NextResponse.json({ error: "That application link is no longer valid." }, { status: 404 });

  // A requalification shows the office's note and what needs renewing.
  let requalification: { company: string | null; message: string | null; renew: { label: string; expires_on: string | null; status: string }[] } | null = null;
  if (app.source === REQUAL_SOURCE && app.company_id) {
    const { data } = await getSupabaseAdmin().from("company_documents").select("*").eq("company_id", app.company_id);
    requalification = {
      company: app.company_name,
      message: app.requal_message ?? null,
      renew: outstandingDocuments((data ?? []) as CompanyDocument[]).filter((d) => d.doc_type !== "msa")
        .map((d) => ({ label: d.label || d.doc_type.toUpperCase(), expires_on: d.expires_on, status: d.status })),
    };
  }

  // Only what the applicant needs back — never staff notes or the decision.
  return NextResponse.json({
    requalification,
    token: app.token,
    status: app.status,
    answers: app.answers,
    progress: app.progress,
    current_step: app.current_step,
    submitted_at: app.submitted_at,
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};
    const result = await saveAnswers(token, answers, typeof body?.step === "string" ? body.step : null);
    return NextResponse.json(result);
  } catch (err) {
    const e = err as PrequalError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
