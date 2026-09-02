// Convert one or more contact form submissions into Contacts, Leads (quotes),
// or Deals (pipeline). Transfers the full submission payload to the target.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  convertSubmissionToContact, convertSubmissionToLead, convertSubmissionToDeal,
} from "@/lib/contact-submissions/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

type Body = { ids: string[]; target: "contact" | "lead" | "deal" };

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't convert submissions.` }, { status: 403 });
    }
    const { ids, target } = (await request.json()) as Body;
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!list.length) return NextResponse.json({ error: "No submissions selected." }, { status: 400 });
    if (!["contact", "lead", "deal"].includes(target)) {
      return NextResponse.json({ error: "Invalid target." }, { status: 400 });
    }

    const actor = { name: user.email, id: staff.id };
    const results = await Promise.all(list.map((id) => {
      if (target === "contact") return convertSubmissionToContact(id);
      if (target === "lead") return convertSubmissionToLead(id);
      return convertSubmissionToDeal(id, actor);
    }));

    return NextResponse.json({ target, count: results.length, results }, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message ?? "Conversion failed." }, { status: e.status ?? 500 });
  }
}
