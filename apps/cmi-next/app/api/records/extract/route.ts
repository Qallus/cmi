// Bolt reads free-text job files (.txt / .md) and returns structured Pre-Con
// or Job records, with its suggestion of which list each belongs in. Nothing is
// saved here — the import dialog previews the result and the user confirms.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { callHermes, extractJson, hermesConfigured } from "@/lib/canvas/bolt";
import { FIELDS, type RecordTarget } from "@/lib/records-io/fields";

export const runtime = "nodejs";
const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];
const MAX_FILES = 25;
const MAX_CHARS = 24_000;

type BoltRecord = { destination?: string; reason?: string; fields?: Record<string, unknown> };

function schemaFor(target: RecordTarget): string {
  return FIELDS[target]
    .map((f) => `  - ${f.key} (${f.kind}${f.options ? `: one of ${f.options.join(", ")}` : ""})${f.required ? " REQUIRED" : ""}${f.hint ? ` — ${f.hint}` : ""}`)
    .join("\n");
}

const SYSTEM_PROMPT = `You are Bolt, the data-entry assistant for Constructed Matter, Inc. (CMI), a design-build construction company in Arizona.
You read a text file describing one or more construction projects and turn each project into a structured record.

DECIDE WHERE EACH PROJECT BELONGS
- "precon": not yet under a signed construction contract — leads, opportunities, budgeting/estimating, design, pre-construction, LOI or pre-con agreement stage, long leads.
- "jobs": construction contract signed or work underway — active construction, warranty, closed/completed projects.
If unclear, choose "precon".

FIELDS FOR "precon" RECORDS
${schemaFor("precon")}

FIELDS FOR "jobs" RECORDS
${schemaFor("jobs")}

RULES
- Use only facts stated in the text. Never invent values; omit any field you can't find.
- Numbers are plain numbers with no $ or commas (e.g. 400000). Dates are YYYY-MM-DD.
- Put scope, status and follow-up details into the notes field, keeping the original wording.
- If a project name starts with a CMI number like "26_030", also put that number in job_number.

Reply with ONLY a JSON object, no prose:
{"records":[{"destination":"precon"|"jobs","reason":"one short sentence","fields":{...}}]}`;

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't import records.` }, { status: 403 });
    }
    if (!hermesConfigured()) return NextResponse.json({ error: "Bolt isn't configured on this server (HERMES_AGENT_URL)." }, { status: 503 });

    const body = (await request.json()) as { files?: { name: string; text: string }[] };
    const files = (body.files ?? []).filter((f) => f?.text?.trim()).slice(0, MAX_FILES);
    if (files.length === 0) return NextResponse.json({ error: "No text to read." }, { status: 400 });

    const out: { source: string; destination: RecordTarget; reason: string; fields: Record<string, unknown> }[] = [];
    const errors: string[] = [];

    // Files are read one at a time so a long batch doesn't hit the gateway all at once.
    for (const file of files) {
      const res = await callHermes([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `File: ${file.name}\n\n${file.text.slice(0, MAX_CHARS)}` },
      ], { temperature: 0.1 });
      if ("error" in res) { errors.push(`${file.name}: ${res.error}`); continue; }
      const parsed = extractJson<{ records?: BoltRecord[] } | BoltRecord[]>(res.content);
      const records = Array.isArray(parsed) ? parsed : parsed?.records;
      if (!records?.length) { errors.push(`${file.name}: Bolt couldn't find a project in this file.`); continue; }
      for (const r of records) {
        out.push({
          source: file.name,
          destination: r.destination === "jobs" ? "jobs" : "precon",
          reason: typeof r.reason === "string" ? r.reason : "",
          fields: r.fields && typeof r.fields === "object" ? r.fields : {},
        });
      }
    }
    return NextResponse.json({ records: out, errors });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
