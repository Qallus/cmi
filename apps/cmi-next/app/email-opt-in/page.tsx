import Link from "next/link";
import { ConsentPageLayout } from "@/components/consent/consent-page-layout";
import { ConsentForm, type ConsentOption } from "@/components/consent/consent-form";
import { LEGAL_ROUTES } from "@/components/legal/legal-page";

export const metadata = {
  title: "Email Opt-In — Constructed Matter, Inc.",
  description:
    "Manage which emails you receive from Constructed Matter, Inc. Marketing-email consent is optional and is not a condition of purchase.",
};

const OPTIONS: ConsentOption[] = [
  {
    value: "service",
    categories: ["service"],
    title: "Yes, I would like to receive service, account, and project-related emails from Constructed Matter, Inc.",
    body:
      "These emails may include inquiry responses, estimates, proposals, appointments, project schedules, design selections, approvals, permits, inspections, invoices, warranties, safety notices, documents, and other communications related to my request, account, business relationship, or project.",
  },
  {
    value: "marketing",
    categories: ["marketing"],
    title: "Yes, I would like to receive marketing emails from Constructed Matter, Inc.",
    body:
      "These emails may include CMI news, services, construction and design content, events, announcements, offers, promotions, and follow-up marketing.",
    fineprint:
      "I understand that I may unsubscribe from marketing emails at any time by using the unsubscribe link in an email or visiting the CMI Email Opt-Out page.",
  },
];

export default function EmailOptInPage() {
  return (
    <ConsentPageLayout
      eyebrow="Email Opt-In"
      title="Choose the Emails You Would Like to Receive"
      currentHref={LEGAL_ROUTES.emailOptIn}
      intro={
        <p>
          Use this form to manage email communications from Constructed Matter, Inc. (&ldquo;CMI&rdquo;).
        </p>
      }
      aside={
        <>
          <h2 id="important-information">Important Information</h2>
          <p>Marketing-email consent is optional and is not a condition of purchase.</p>
          <p>
            Even if you unsubscribe from marketing, CMI may continue sending transactional or relationship emails
            that are reasonably necessary to:
          </p>
          <ul>
            <li>Respond to a request;</li>
            <li>Administer an account;</li>
            <li>Schedule or perform an appointment;</li>
            <li>Provide an estimate, proposal, contract, or requested service;</li>
            <li>Coordinate an active construction or design project;</li>
            <li>Send invoice, payment, warranty, safety, or legal information; or</li>
            <li>Comply with a contractual or legal obligation.</li>
          </ul>

          <h2 id="contact">Contact</h2>
          <p>
            <strong>Constructed Matter, Inc.</strong>
            <br />
            7314 E Osborn Dr, Suite A
            <br />
            Scottsdale, AZ 85251
            <br />
            Phone: <a href="tel:+14806284458">(480) 628-4458</a>
            <br />
            Email: <a href="mailto:info@constructedmatter.com">info@constructedmatter.com</a>
          </p>
          <p>
            Need to unsubscribe instead? Use the{" "}
            <Link href={LEGAL_ROUTES.emailOptOut}>Email Opt-Out</Link> page.
          </p>
        </>
      }
    >
      <ConsentForm
        channel="email"
        mode="opt_in"
        fields={{ name: "required", email: "required", company: "optional", relationship: "optional" }}
        options={OPTIONS}
        optionsLegend="Email communication choices"
        optionsHint="Both boxes are optional and start unchecked. Select either, both, or neither."
        submitLabel="Save My Email Preferences"
        acknowledgment={
          <>
            <p className="font-medium text-foreground">
              By selecting a checkbox and submitting this form, I confirm that:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>I am authorized to use the email address provided;</li>
              <li>My preferences apply to the categories selected;</li>
              <li>I may update or withdraw my marketing-email preference at any time; and</li>
              <li>
                I have reviewed the{" "}
                <Link href={LEGAL_ROUTES.privacy} className="text-accent underline underline-offset-4">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href={LEGAL_ROUTES.terms} className="text-accent underline underline-offset-4">
                  Terms of Service
                </Link>
                .
              </li>
            </ul>
          </>
        }
        confirmation={{
          heading: "Thank you. Your CMI email preferences have been saved.",
          body: (
            <>
              <p>
                For improved list quality and consent verification, CMI may send a confirmation email asking you to
                verify your subscription.
              </p>
              <p>
                You can update your preferences at any time on the{" "}
                <Link href={LEGAL_ROUTES.emailOptOut} className="text-accent underline underline-offset-4">
                  Email Opt-Out
                </Link>{" "}
                page.
              </p>
            </>
          ),
        }}
      />
    </ConsentPageLayout>
  );
}
