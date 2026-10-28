// What happens once an application is submitted, after the company and
// primary contact exist: contacts by role, the applicant's confirmation email,
// and the office alert. Each step is best-effort — a submission is never lost
// over an email or a CRM link.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notificationEmailHtml } from "@/lib/email/notification-email";
import { notifyStaff } from "@/lib/notifications/dispatch";
import { contactsByRole, type Answers } from "./form";
import { sendApplicantEmail } from "./mail";
import { PREQUAL_DECIDE_ROLES } from "./access";
import { TP_FOOTER } from "./msa";
import type { Application } from "./data";

/**
 * Tag the primary contact and add/link a contact per role (accounting,
 * estimating, field, emergency) so bid packages can pull people by role.
 */
export async function linkRoleContacts(answers: Answers, companyId: string, primaryContactId: string | null): Promise<void> {
  const supabase = getSupabaseAdmin();
  const roles = contactsByRole(answers);
  const primaryRoles = ["primary", ...roles.filter((r) => r.samePrimary).map((r) => r.role)];
  if (primaryContactId) {
    const { data } = await supabase.from("contacts").select("company_roles").eq("id", primaryContactId).maybeSingle();
    const merged = [...new Set([...((data?.company_roles as string[] | null) ?? []), ...primaryRoles])];
    await supabase.from("contacts").update({ company_roles: merged }).eq("id", primaryContactId);
  }

  const company = String(answers.company_name ?? "");
  for (const r of roles.filter((x) => !x.samePrimary)) {
    try {
      const [first, ...rest] = r.name.split(/\s+/);
      const email = r.email?.toLowerCase() ?? null;
      // Reuse a contact with the same email at all; otherwise add one.
      const existing = email
        ? (await supabase.from("contacts").select("id, company_roles").ilike("email", email.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle()).data
        : null;
      if (existing) {
        const merged = [...new Set([...((existing.company_roles as string[] | null) ?? []), r.role])];
        await supabase.from("contacts").update({ company_id: companyId, company, company_roles: merged }).eq("id", existing.id);
        continue;
      }
      if (!first) continue;
      await supabase.from("contacts").insert({
        first_name: first, last_name: rest.join(" ") || first, email, phone: r.phone,
        company, company_id: companyId, company_roles: [r.role],
        type: "Sub Contractor", status: "active", source: "Prequalification", tags: ["prequalification"],
        last_activity: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[prequal] role contact failed", r.role, err);
    }
  }
}

/** Confirmation to the applicant from info@, listing anything still owed. */
export async function sendConfirmation(app: Application, answers: Answers, missingDocs: string[], signedMsa: boolean): Promise<void> {
  const email = String(answers.contact_email ?? "").trim();
  if (!email) return;
  const first = String(answers.contact_first_name ?? "").trim() || "there";
  const company = String(answers.company_name ?? "") || "your company";
  try {
    await sendApplicantEmail({
      to: email,
      subject: "We received your Constructed Matter trade partner application",
      replyTo: "info@constructedmatter.com",
      html: notificationEmailHtml({
        audience: "external", footerNote: TP_FOOTER,
        eyebrow: "Trade partner application",
        heading: "Thank you, we've received your application",
        paragraphs: [
          `Hi ${first}, thank you for applying to work with Constructed Matter. Our team reviews every application and will be in touch about next steps.`,
          missingDocs.length
            ? "Before we can issue work we'll need the documents listed below. Reply to this email with them attached whenever they're ready."
            : "Everything we need to get started is on file.",
        ],
        facts: [
          { label: "Company", value: company },
          { label: "Submitted", value: new Date().toLocaleDateString("en-US", { timeZone: "America/Phoenix", dateStyle: "long" }) },
          { label: "Master Subcontractor Agreement", value: signedMsa ? "Signed (copy sent separately)" : "We'll send it for signature" },
          ...missingDocs.map((d) => ({ label: "Still needed", value: d })),
        ],
        closing: "Questions? Reply to this email or call (480) 628-4458.",
      }),
    });
  } catch (err) {
    console.error("[prequal] confirmation email failed", err);
  }
}

/** Tell the office a new application is waiting. */
export async function alertOffice(app: Application, answers: Answers): Promise<void> {
  try {
    const { data } = await getSupabaseAdmin().from("staff_users").select("id")
      .in("role_slug", [...PREQUAL_DECIDE_ROLES]).in("status", ["active", "invited"]);
    const company = String(answers.company_name ?? "") || [answers.contact_first_name, answers.contact_last_name].filter(Boolean).join(" ");
    const trades = Array.isArray(answers.trades) ? (answers.trades as string[]).join(", ") : "";
    const result = await notifyStaff({
      recipientIds: (data ?? []).map((r) => r.id as string),
      kind: "prequal_submitted",
      title: `New trade partner application: ${company}`,
      body: trades || null,
      url: "/dashboard/trade-partners",
      sourceTable: "prequal_applications",
      sourceId: app.id,
      dedupeKey: `prequal_submitted:${app.id}`,
      email: {
        subject: `New trade partner application: ${company}`,
        content: {
          eyebrow: "Trade partners",
          heading: `${company} applied to work with us`,
          facts: [
            { label: "Contact", value: [answers.contact_first_name, answers.contact_last_name].filter(Boolean).join(" ") },
            { label: "Email", value: String(answers.contact_email ?? "") },
            ...(trades ? [{ label: "Trades", value: trades }] : []),
          ],
        },
        ctaLabel: "Review application",
      },
    });
    const real = result.errors.filter((e) => !e.startsWith("outbound held"));
    if (real.length) console.error("[prequal] office alert problems", real);
  } catch (err) {
    console.error("[prequal] office alert failed", err);
  }
}
