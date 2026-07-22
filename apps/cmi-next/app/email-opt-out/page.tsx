import Link from "next/link";
import { ConsentPageLayout } from "@/components/consent/consent-page-layout";
import { ConsentForm, type ConsentOption } from "@/components/consent/consent-form";
import { LEGAL_ROUTES } from "@/components/legal/legal-page";

export const metadata = {
  title: "Email Opt-Out — Constructed Matter, Inc.",
  description:
    "Unsubscribe from Constructed Matter, Inc. marketing emails. No login, fee, or additional information required.",
};

// Every option maps to the marketing category. CMI does not yet segment
// marketing email by topic, so any selection is applied as a full
// marketing-email opt-out — the outcome that most favours the recipient. Once
// topic segmentation exists in the ESP, split these into distinct categories.
const OPTIONS: ConsentOption[] = [
  {
    value: "all_marketing",
    categories: ["marketing"],
    title: "Unsubscribe me from all CMI marketing and promotional emails",
  },
  {
    value: "newsletters",
    categories: ["marketing"],
    title: "Unsubscribe me from newsletters and educational content",
  },
  {
    value: "events",
    categories: ["marketing"],
    title: "Unsubscribe me from event invitations",
  },
  {
    value: "offers",
    categories: ["marketing"],
    title: "Unsubscribe me from offers and promotions",
  },
];

export default function EmailOptOutPage() {
  return (
    <ConsentPageLayout
      eyebrow="Email Opt-Out"
      title="Unsubscribe From Constructed Matter Marketing Emails"
      currentHref={LEGAL_ROUTES.emailOptOut}
      intro={
        <>
          <p>
            Use this page to stop or reduce marketing emails from Constructed Matter, Inc. (&ldquo;CMI&rdquo;).
          </p>
          <p>You may also use the unsubscribe link included in a CMI marketing email.</p>
        </>
      }
      aside={
        <>
          <h2 id="what-you-may-still-receive">What You May Still Receive</h2>
          <p>
            After unsubscribing from marketing emails, CMI may continue sending non-marketing communications that are
            reasonably necessary to:
          </p>
          <ul>
            <li>Respond to an inquiry or request;</li>
            <li>Confirm or manage an appointment;</li>
            <li>Administer an account;</li>
            <li>Deliver an estimate, proposal, contract, invoice, receipt, or warranty notice;</li>
            <li>Coordinate an active project or service;</li>
            <li>Provide safety, security, access, permit, inspection, or legal information;</li>
            <li>
              Communicate with contractors, subcontractors, vendors, designers, consultants, or government
              representatives about authorized work; or
            </li>
            <li>Comply with a contract or law.</li>
          </ul>

          <h2 id="no-login-fee-or-additional-information-required">
            No Login, Fee, or Additional Information Required
          </h2>
          <p>CMI will not require you to:</p>
          <ul>
            <li>Pay a fee;</li>
            <li>Sign in to an account;</li>
            <li>
              provide personal information beyond the email address reasonably needed to identify the subscription;
              or
            </li>
            <li>complete more than a simple unsubscribe page or reply-email process.</li>
          </ul>

          <h2 id="contact">Contact</h2>
          <p>For help with your email preferences:</p>
          <p>
            <strong>Constructed Matter, Inc.</strong>
            <br />
            7314 E Osborn Dr, Suite A
            <br />
            Scottsdale, AZ 85251
            <br />
            Phone: <a href="tel:+14806284458">(480) 628-4458</a>
            <br />
            Email: <a href="mailto:hello@constructedmatter.com">hello@constructedmatter.com</a>
          </p>
          <p>
            Want CMI email again later? You can <Link href={LEGAL_ROUTES.emailOptIn}>opt back in here</Link>.
          </p>
        </>
      }
    >
      <ConsentForm
        channel="email"
        mode="opt_out"
        fields={{ email: "required" }}
        options={OPTIONS}
        optionsLegend="Select your preference"
        optionsHint="Selecting any option below stops CMI marketing and promotional email to this address. Transactional and project emails are not affected."
        submitLabel="Update My Email Preferences"
        confirmation={{
          heading: "Your email preference request has been received.",
          body: (
            <>
              <p>
                CMI will process your marketing-email opt-out as promptly as reasonably possible and within the time
                required by applicable law.
              </p>
              <p>
                You may still receive non-marketing emails that are necessary to respond to a request, manage an
                appointment or account, deliver a document, coordinate an active project, or comply with a contract
                or law.
              </p>
            </>
          ),
        }}
      />
    </ConsentPageLayout>
  );
}
