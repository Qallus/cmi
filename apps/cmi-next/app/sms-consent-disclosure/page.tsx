import Image from "next/image";
import Link from "next/link";
import { LegalPageLayout, LEGAL_ROUTES, CMI_CONTACT } from "@/components/legal/legal-page";
import {
  SMS_FINEPRINT, SMS_SERVICE_LABEL, SMS_SERVICE_BODY,
  SMS_MARKETING_LABEL, SMS_MARKETING_BODY,
  SMS_BOOKING_LABEL, SMS_BOOKING_BODY,
} from "@/lib/messaging/disclosure";

// Evidence page for carrier / A2P 10DLC campaign review. It shows, in one
// place, every way someone can consent to CMI text messages and the exact
// words they see when they do. Public so a reviewer can open it without an
// account; excluded from search results because it is not marketing content.
export const metadata = {
  title: "SMS Consent Disclosure — Constructed Matter, Inc.",
  description:
    "How Constructed Matter, Inc. collects consent for text messages: every opt-in path, the exact consent language, and how to opt out.",
  robots: { index: false, follow: false },
};

const SITE = "https://constructedmatter.com";

function Quote({ children }: { children: React.ReactNode }) {
  return <div className="cmi-legal-note">{children}</div>;
}

export default function SmsConsentDisclosurePage() {
  return (
    <LegalPageLayout
      title="SMS Consent Disclosure"
      effectiveDate="September 23, 2026"
      intro="A single reference showing every way a person can consent to receive text messages from Constructed Matter, Inc., the exact language shown at the moment of consent, and how consent is recorded and withdrawn."
      currentHref="/sms-consent-disclosure"
    >
      <h2 id="summary">1. Summary</h2>

      <p>
        Constructed Matter, Inc. (&ldquo;CMI&rdquo;) is a licensed Arizona construction firm (ROC KB-1 #343120)
        at {CMI_CONTACT.addressLine}, {CMI_CONTACT.addressCityStateZip}. CMI sends text messages only to people
        who have asked to receive them.
      </p>

      <p>
        Consent is never bought, rented, shared, or inherited from another sender. Being a CMI client,
        subcontractor, vendor, or employee does not by itself constitute consent. Every opt-in below is a
        separate, optional checkbox that is unchecked by default, and no CMI product or service requires it.
      </p>

      <h2 id="paths">2. Every way to opt in</h2>

      <p>There are three, and only three, places where a person can consent to CMI text messages.</p>

      <h3>2.1 SMS preference page — {SITE}/sms-opt-in</h3>

      <p>
        The primary path, publicly accessible with no login. The visitor enters their name and mobile number,
        then ticks one or both of the following, and presses <strong>Save My SMS Preferences</strong>. Both
        boxes are optional and start unchecked.
      </p>

      <p>
        <strong>Service and project messages</strong> — the category used for transactional and operational
        messaging:
      </p>

      <Quote>
        <p>
          <strong>{SMS_SERVICE_LABEL}</strong>
        </p>
        <p>{SMS_SERVICE_BODY}</p>
        <p>{SMS_FINEPRINT}</p>
      </Quote>

      <p>
        <strong>Marketing messages</strong> — a separate consent, collected and stored independently:
      </p>

      <Quote>
        <p>
          <strong>{SMS_MARKETING_LABEL}</strong>
        </p>
        <p>{SMS_MARKETING_BODY}</p>
        <p>{SMS_FINEPRINT}</p>
      </Quote>

      <p>
        Ticking the marketing box alone does not enrol anyone in service messaging, and ticking the service box
        alone does not enrol anyone in marketing. Beneath the checkboxes the page states that the person is the
        subscriber or customary user of the number, that consent applies only to the selected categories, that
        consent is voluntary and not required to obtain goods or services, that it can be revoked at any time by
        replying STOP, and that they have reviewed the{" "}
        <Link href={LEGAL_ROUTES.terms}>Terms of Service</Link> and{" "}
        <Link href={LEGAL_ROUTES.privacy}>Privacy Policy</Link>.
      </p>

      <figure>
        <Image
          src="/legal/sms-opt-in-form.png"
          alt="The CMI SMS opt-in page showing the name and mobile number fields, both unchecked consent checkboxes with their full disclosures, and the Save My SMS Preferences button."
          width={1265}
          height={2709}
          className="w-full rounded-lg border border-border"
        />
        <figcaption>The complete opt-in form at {SITE}/sms-opt-in.</figcaption>
      </figure>

      <h3>2.2 Appointment booking — {SITE}/book</h3>

      <p>
        When requesting a consultation or site visit, the visitor may tick an optional, unchecked box carrying
        the same disclosures. This consent is narrower: it covers the appointment being booked.
      </p>

      <Quote>
        <p>
          <strong>{SMS_BOOKING_LABEL}</strong>
        </p>
        <p>{SMS_BOOKING_BODY}</p>
        <p>{SMS_FINEPRINT}</p>
      </Quote>

      <h3>2.3 Event registration — {SITE}/events/&#123;event&#125;</h3>

      <p>
        Registration pages for CMI events carry the identical optional checkbox and identical disclosure text as
        the booking form above.
      </p>

      <h3>2.4 There is no keyword opt-in</h3>

      <p>
        CMI does not advertise a short code or &ldquo;text JOIN to&rdquo; keyword, and no campaign is enrolled by
        inbound keyword. Replying <strong>START</strong> to a CMI message resumes service messaging for someone
        who had previously opted out; it never grants marketing consent and never creates a new subscription.
      </p>

      <h2 id="record">3. What is recorded</h2>

      <p>For every opt-in, CMI stores an immutable record containing:</p>

      <ul>
        <li>The mobile number;</li>
        <li>The message categories consented to;</li>
        <li>The date and time of consent;</li>
        <li>The page URL where consent was given;</li>
        <li>The IP address and browser user agent of the submission;</li>
        <li>The verbatim disclosure text displayed at that moment; and</li>
        <li>A version identifier for that disclosure wording.</li>
      </ul>

      <p>
        Storing the wording itself means CMI can show precisely what any individual agreed to on any given date,
        even after the page text changes.
      </p>

      <h2 id="optout">4. Opting out and getting help</h2>

      <p>
        Replying <strong>STOP</strong>, <strong>STOPALL</strong>, <strong>UNSUBSCRIBE</strong>,{" "}
        <strong>CANCEL</strong>, <strong>END</strong>, <strong>QUIT</strong>, <strong>OPTOUT</strong>, or{" "}
        <strong>REVOKE</strong> to any CMI message stops all text messages on that number immediately and is
        recorded in the same audit log. Consent can also be withdrawn without sending a text, at{" "}
        <Link href={LEGAL_ROUTES.smsOptOut}>{SITE}/sms-opt-out</Link>, which additionally allows a
        marketing-only withdrawal that leaves appointment and project messages in place.
      </p>

      <p>
        Replying <strong>HELP</strong> or <strong>INFO</strong> returns the CMI brand name, a description of the
        messaging programme, message frequency and rate disclosures, opt-out instructions, and a phone number and
        email address for a person.
      </p>

      <figure>
        <Image
          src="/legal/sms-opt-out-form.png"
          alt="The CMI SMS opt-out page, offering a full stop or a marketing-only withdrawal, with the supported opt-out keywords listed."
          width={1265}
          height={2000}
          className="w-full rounded-lg border border-border"
        />
        <figcaption>The opt-out form at {SITE}/sms-opt-out.</figcaption>
      </figure>

      <h2 id="sharing">5. Mobile numbers are not shared</h2>

      <Quote>
        <strong>
          CMI does not sell, rent, trade, or share mobile phone numbers, SMS opt-in data, or messaging consent
          information with third parties or affiliates for their own marketing or promotional purposes.
        </strong>
      </Quote>

      <p>
        Mobile information is disclosed only to the service providers that operate CMI&apos;s messaging, CRM,
        scheduling, hosting, and support systems, and only so they can provide those services to CMI. SMS consent
        is never transferred to another sender. This is stated in full in{" "}
        <Link href={LEGAL_ROUTES.privacy}>Privacy Policy</Link> section 3, alongside the message frequency and
        message-and-data-rates disclosures. The messaging programme is described in{" "}
        <Link href={LEGAL_ROUTES.terms}>Terms of Service</Link> section 12.
      </p>

      <h2 id="contact">6. Contact</h2>

      <p>
        <strong>{CMI_CONTACT.legalName}</strong>
        <br />
        {CMI_CONTACT.addressLine}, {CMI_CONTACT.addressCityStateZip}
        <br />
        Phone: <a href={CMI_CONTACT.phoneHref}>{CMI_CONTACT.phone}</a>
        <br />
        Email: <a href={`mailto:${CMI_CONTACT.email}`}>{CMI_CONTACT.email}</a>
      </p>
    </LegalPageLayout>
  );
}
