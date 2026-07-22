import Link from "next/link";
import { ConsentPageLayout } from "@/components/consent/consent-page-layout";
import { ConsentForm, type ConsentOption } from "@/components/consent/consent-form";
import { LEGAL_ROUTES } from "@/components/legal/legal-page";

export const metadata = {
  title: "SMS Opt-Out — Constructed Matter, Inc.",
  description:
    "Revoke your consent to receive SMS or MMS messages from Constructed Matter, Inc. No account or login required.",
};

const OPTIONS: ConsentOption[] = [
  {
    value: "all",
    categories: ["service", "marketing"],
    title: "Stop all SMS and MMS messages from CMI",
    body:
      "You will no longer receive any text messages from the applicable CMI messaging program unless you provide new consent.",
  },
  {
    value: "marketing",
    categories: ["marketing"],
    title: "Stop marketing and promotional SMS messages only",
    body:
      "You will still receive service, account, and project-related texts such as appointment reminders and project updates.",
  },
];

export default function SmsOptOutPage() {
  return (
    <ConsentPageLayout
      eyebrow="SMS Opt-Out"
      title="Stop Text Messages From Constructed Matter"
      currentHref={LEGAL_ROUTES.smsOptOut}
      intro={
        <>
          <p>
            You may revoke your consent to receive SMS or MMS messages from Constructed Matter, Inc.
            (&ldquo;CMI&rdquo;) at any time.
          </p>
          <p>
            The fastest method is to reply <strong className="font-semibold text-foreground">STOP</strong> to the CMI
            text message you received. You may also use this form — no account or login is required.
          </p>
        </>
      }
      aside={
        <>
          <h2 id="what-happens-next">What Happens Next</h2>
          <ul>
            <li>CMI will process your request as promptly as reasonably possible.</li>
            <li>
              If you reply STOP by text, you may receive one final SMS confirming that the opt-out request was
              processed.
            </li>
            <li>
              After an all-SMS opt-out is processed, CMI will not send additional SMS or MMS messages to that number
              from the applicable CMI messaging program unless you provide new consent.
            </li>
            <li>CMI may retain your mobile number on a suppression list so that we can honor your request.</li>
            <li>
              Opting out of SMS does not cancel an appointment, estimate, contract, project, invoice, warranty,
              account, or other obligation.
            </li>
            <li>
              CMI may contact you through another lawful method for essential project, account, contractual, safety,
              billing, or legal matters.
            </li>
          </ul>

          <h2 id="text-to-stop-options">Text-to-Stop Options</h2>
          <p>You may reply with any supported opt-out keyword, including:</p>
          <p>
            <strong>STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, OPTOUT,</strong> or <strong>REVOKE</strong>
          </p>
          <p>
            Reply <strong>HELP</strong> for assistance.
          </p>

          <h2 id="need-assistance">Need Assistance?</h2>
          <p>
            <strong>Constructed Matter, Inc.</strong>
            <br />
            Phone: <a href="tel:+14806284458">(480) 628-4458</a>
            <br />
            Email: <a href="mailto:hello@constructedmatter.com">hello@constructedmatter.com</a>
            <br />
            Address: 7314 E Osborn Dr, Suite A, Scottsdale, AZ 85251
          </p>
          <p>
            Want texts again later? You can <Link href={LEGAL_ROUTES.smsOptIn}>opt back in here</Link>.
          </p>
        </>
      }
    >
      <ConsentForm
        channel="sms"
        mode="opt_out"
        fields={{ phone: "required", email: "optional" }}
        options={OPTIONS}
        optionsLegend="Select your request"
        optionsHint="If you arrived here from a general unsubscribe link, choose “Stop all SMS and MMS messages from CMI.”"
        submitLabel="Unsubscribe My Mobile Number"
        confirmation={{
          heading: "Your SMS opt-out request has been received.",
          body: (
            <>
              <p>
                We will update our records and stop the selected text-message category. To receive CMI texts again in
                the future, you must provide new consent.
              </p>
              <p>
                Opting out of SMS does not cancel an appointment, estimate, contract, project, invoice, warranty,
                account, or other obligation.
              </p>
            </>
          ),
          variants: [
            {
              whenValues: ["marketing"],
              body: (
                <>
                  <p>
                    We will update our records and stop marketing and promotional texts. Service, account, and
                    project-related texts will continue.
                  </p>
                  <p>
                    Opting out does not cancel an appointment, estimate, contract, project, invoice, warranty,
                    account, or other obligation.
                  </p>
                </>
              ),
            },
          ],
        }}
      />
    </ConsentPageLayout>
  );
}
