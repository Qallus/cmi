import Link from "next/link";
import { ConsentPageLayout } from "@/components/consent/consent-page-layout";
import { ConsentForm, type ConsentOption } from "@/components/consent/consent-form";
import { LEGAL_ROUTES } from "@/components/legal/legal-page";

export const metadata = {
  title: "SMS Opt-In — Constructed Matter, Inc.",
  description:
    "Choose which text messages you would like to receive from Constructed Matter, Inc. SMS consent is optional and is never a condition of purchase.",
};

const FINEPRINT =
  "Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of purchase.";

const OPTIONS: ConsentOption[] = [
  {
    value: "service",
    categories: ["service"],
    title:
      "Yes, I agree to receive recurring service, account, and project-related SMS or MMS messages from Constructed Matter, Inc. at the mobile number provided.",
    body:
      "Messages may include inquiry follow-ups, estimate or proposal updates, appointment reminders, project schedules, milestones, design selections, approvals, permitting or inspection updates, site-access coordination, delivery notices, invoices, payment reminders, warranties, service updates, safety notices, and communications with authorized project participants.",
    fineprint: FINEPRINT,
  },
  {
    value: "marketing",
    categories: ["marketing"],
    title:
      "Yes, I expressly agree to receive recurring marketing and promotional SMS or MMS messages from Constructed Matter, Inc. at the mobile number provided.",
    body:
      "Messages may include information about CMI services, construction or design content, events, announcements, offers, promotions, and follow-up marketing.",
    fineprint: FINEPRINT,
  },
];

export default function SmsOptInPage() {
  return (
    <ConsentPageLayout
      eyebrow="SMS Opt-In"
      title="Stay Connected With Constructed Matter"
      currentHref={LEGAL_ROUTES.smsOptIn}
      intro={
        <>
          <p>
            Use this form to choose which text messages you would like to receive from Constructed Matter, Inc.
            (&ldquo;CMI&rdquo;).
          </p>
          <p>
            Providing SMS consent is optional. You may request an estimate, schedule a consultation, create an
            account, purchase services, or enter into an agreement with CMI without agreeing to receive marketing
            text messages.
          </p>
        </>
      }
      aside={
        <>
          <h2 id="need-help">Need Help?</h2>
          <p>
            Reply <strong>HELP</strong> to a CMI text message or contact:
          </p>
          <p>
            <strong>Constructed Matter, Inc.</strong>
            <br />
            Phone: <a href="tel:+14806284458">(480) 628-4458</a>
            <br />
            Email: <a href="mailto:info@constructedmatter.com">info@constructedmatter.com</a>
            <br />
            Address: 7314 E Osborn Dr, Suite A, Scottsdale, AZ 85251
          </p>
          <p>
            CMI does not sell, rent, or share mobile phone numbers or SMS consent information with third parties or
            affiliates for their own marketing or promotional purposes.
          </p>
          <p>
            Changed your mind? You can <Link href={LEGAL_ROUTES.smsOptOut}>opt out of SMS at any time</Link>.
          </p>
        </>
      }
    >
      <ConsentForm
        channel="sms"
        mode="opt_in"
        fields={{ name: "required", phone: "required", email: "optional", company: "optional", relationship: "optional" }}
        options={OPTIONS}
        optionsLegend="SMS communication choices"
        optionsHint="Both boxes are optional and start unchecked. Select either, both, or neither — you can complete any other CMI form or process without choosing one."
        submitLabel="Save My SMS Preferences"
        acknowledgment={
          <>
            <p className="font-medium text-foreground">
              By selecting a checkbox and submitting this form, I confirm that:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                I am the subscriber or customary user of the mobile number provided, or I am authorized to provide
                consent for that number;
              </li>
              <li>My consent applies only to the selected message category or categories;</li>
              <li>My consent is voluntary and is not required to obtain goods or services;</li>
              <li>
                I may revoke consent at any time by replying <strong>STOP</strong>, using the{" "}
                <Link href={LEGAL_ROUTES.smsOptOut} className="text-accent underline underline-offset-4">
                  SMS Opt-Out
                </Link>{" "}
                page, or contacting CMI; and
              </li>
              <li>
                I have reviewed the{" "}
                <Link href={LEGAL_ROUTES.terms} className="text-accent underline underline-offset-4">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href={LEGAL_ROUTES.privacy} className="text-accent underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </li>
            </ul>
          </>
        }
        confirmation={{
          heading: "Thank you. Your CMI SMS preferences have been saved.",
          variants: [
            { whenValues: ["service"], heading: "Thank you. Your service and project SMS preference has been saved." },
            { whenValues: ["marketing"], heading: "Thank you. Your marketing SMS preference has been saved." },
          ],
          body: (
            <>
              <p>
                Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for
                help.
              </p>
              <p>
                You can change your mind at any time on the{" "}
                <Link href={LEGAL_ROUTES.smsOptOut} className="text-accent underline underline-offset-4">
                  SMS Opt-Out
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
