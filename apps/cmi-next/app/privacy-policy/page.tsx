import Link from "next/link";
import { LegalPageLayout, LEGAL_ROUTES } from "@/components/legal/legal-page";

export const metadata = {
  title: "Privacy Policy — Constructed Matter, Inc.",
  description:
    "How Constructed Matter, Inc. collects, uses, discloses, retains, and protects personal information when you interact with us.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      effectiveDate="July 22, 2026"
      currentHref={LEGAL_ROUTES.privacy}
    >
      <p>
        <strong>Last Updated:</strong> July 22, 2026
      </p>

      <p>
        Constructed Matter, Inc. (&ldquo;Constructed Matter,&rdquo; &ldquo;CMI,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy. This Privacy Policy explains how we
        collect, use, disclose, retain, and protect personal information when you:
      </p>

      <ul>
        <li>
          Visit constructedmatter.com, my.constructedmatter.com, or another website or landing page that
          links to this Privacy Policy;
        </li>
        <li>Create or use an account in the CMI client, project, vendor, subcontractor, or staff portal;</li>
        <li>
          Request information, an estimate, a consultation, a proposal, or construction-related services;
        </li>
        <li>
          Communicate with us by telephone, text message, email, website form, chat, social media, or in
          person;
        </li>
        <li>
          Participate in a construction, remodeling, design, development, maintenance, consulting, or
          project-management engagement with us; or
        </li>
        <li>Otherwise interact with Constructed Matter.</li>
      </ul>

      <p>
        This Privacy Policy applies to clients, prospective clients, property owners, occupants, developers,
        businesses, general contractors, subcontractors, tradespeople, architects, engineers, designers,
        consultants, vendors, suppliers, real estate professionals, government representatives, inspectors,
        permit authorities, cities, towns, counties, states, and other project participants or business
        contacts.
      </p>

      <h2 id="information-we-collect">1. Information We Collect</h2>

      <p>Depending on your relationship with us, we may collect the following categories of information.</p>

      <h3>1.1 Contact and Identity Information</h3>

      <p>This may include:</p>

      <ul>
        <li>Name;</li>
        <li>Mailing address, service address, project address, and billing address;</li>
        <li>Email address;</li>
        <li>Telephone and mobile phone number;</li>
        <li>Company, agency, department, or organization;</li>
        <li>Job title or professional role;</li>
        <li>Preferred communication method; and</li>
        <li>Signature or other identity-verification information.</li>
      </ul>

      <h3>1.2 Client, Prospect, and CRM Information</h3>

      <p>
        We may maintain information in our custom CMI customer relationship management system (&ldquo;CMI
        CRM&rdquo;), including:
      </p>

      <ul>
        <li>Lead source and inquiry history;</li>
        <li>Client or prospect status;</li>
        <li>Notes from calls, meetings, consultations, and site visits;</li>
        <li>Communication preferences and consent records;</li>
        <li>Appointment, task, follow-up, and reminder history;</li>
        <li>Estimates, proposals, bids, contracts, change orders, selections, and approvals;</li>
        <li>
          Assigned staff, project managers, designers, contractors, subcontractors, vendors, or consultants;
          and
        </li>
        <li>Relationship history with CMI.</li>
      </ul>

      <h3>1.3 Property, Construction, and Project Information</h3>

      <p>
        We may collect information needed to evaluate, plan, price, coordinate, document, or perform work,
        including:
      </p>

      <ul>
        <li>Property addresses and ownership or authorized-representative information;</li>
        <li>Project scope, goals, budget ranges, schedules, milestones, and priorities;</li>
        <li>Plans, drawings, renderings, models, specifications, measurements, and design selections;</li>
        <li>Photographs, video, audio, drone imagery, site documentation, and progress records;</li>
        <li>Inspection, permit, zoning, utility, environmental, code, and entitlement information;</li>
        <li>
          Daily logs, field reports, punch lists, quality-control records, and safety-related information;
        </li>
        <li>Equipment, material, product, fixture, finish, warranty, and supplier information;</li>
        <li>
          Access instructions, gate codes, lockbox information, or site-contact information when reasonably
          necessary;
        </li>
        <li>
          Information about occupants, tenants, neighbors, homeowners&rsquo; associations, or other affected
          parties when relevant to a project; and
        </li>
        <li>
          Records exchanged with architects, engineers, designers, contractors, subcontractors, vendors,
          utilities, cities, counties, states, inspectors, or other authorities.
        </li>
      </ul>

      <p>Please avoid submitting sensitive personal information that is not necessary for the project.</p>

      <h3>1.4 Business Partner, Contractor, and Vendor Information</h3>

      <p>
        For general contractors, subcontractors, tradespeople, designers, architects, engineers, consultants,
        vendors, suppliers, and other partners, we may collect:
      </p>

      <ul>
        <li>Business contact information;</li>
        <li>Licenses, certifications, insurance, bonding, tax, and compliance documentation;</li>
        <li>Trade specialties, service areas, qualifications, and availability;</li>
        <li>
          Proposals, bids, pricing, purchase orders, scopes of work, invoices, and payment information;
        </li>
        <li>Project assignments, performance records, safety documentation, and communications; and</li>
        <li>
          Background or screening information where permitted by law and reasonably necessary.
        </li>
      </ul>

      <h3>1.5 Account and Authentication Information</h3>

      <p>If you use a CMI portal or application, we may collect:</p>

      <ul>
        <li>Username, email, account role, and profile information;</li>
        <li>Password hashes or authentication tokens;</li>
        <li>Login history and device information;</li>
        <li>Permissions, account status, and audit logs; and</li>
        <li>Content, files, comments, messages, and actions submitted through the account.</li>
      </ul>

      <h3>1.6 Payment and Transaction Information</h3>

      <p>
        We may collect billing contacts, invoice details, transaction records, payment status, and related
        financial information. Payment card or bank information may be collected and processed directly by a
        third-party payment provider. CMI generally does not store complete payment-card numbers unless
        specifically disclosed and appropriately secured.
      </p>

      <h3>1.7 Communications and Consent Information</h3>

      <p>We may collect:</p>

      <ul>
        <li>Emails, text messages, chat messages, website submissions, voicemail, and correspondence;</li>
        <li>Call details such as date, time, duration, routing, and disposition;</li>
        <li>Call recordings or transcripts when permitted by law and after any required notice or consent;</li>
        <li>Appointment and meeting notes;</li>
        <li>SMS, email, and telephone consent records;</li>
        <li>
          The date, time, source, form version, disclosure text, IP address, and other evidence associated
          with an opt-in or opt-out request; and
        </li>
        <li>Suppression-list and do-not-contact records used to honor communication preferences.</li>
      </ul>

      <h3>1.8 Website, Device, and Usage Information</h3>

      <p>We and our service providers may automatically collect:</p>

      <ul>
        <li>IP address;</li>
        <li>Browser and device type;</li>
        <li>Operating system;</li>
        <li>Referring and exit pages;</li>
        <li>Pages viewed and features used;</li>
        <li>Date, time, and approximate location derived from an IP address;</li>
        <li>Cookie, pixel, local-storage, and similar technology information; and</li>
        <li>Diagnostic, security, performance, and error-log information.</li>
      </ul>

      <h3>1.9 Information From Other Sources</h3>

      <p>We may receive information from:</p>

      <ul>
        <li>Clients, property owners, project participants, and authorized representatives;</li>
        <li>
          Contractors, subcontractors, designers, architects, engineers, vendors, suppliers, inspectors, and
          consultants;
        </li>
        <li>
          Public records, property records, permitting portals, government agencies, professional
          directories, and publicly available sources;
        </li>
        <li>Referral partners, lead sources, event registrations, and business networking sources;</li>
        <li>
          Marketing, analytics, identity, fraud-prevention, scheduling, CRM, communication, and technology
          providers; and
        </li>
        <li>
          Social media or other platforms when you interact with CMI through those services.
        </li>
      </ul>

      <h2 id="how-we-use-information">2. How We Use Information</h2>

      <p>We may use personal information to:</p>

      <ul>
        <li>Respond to inquiries and evaluate potential projects;</li>
        <li>Schedule consultations, appointments, inspections, walkthroughs, and meetings;</li>
        <li>Prepare estimates, proposals, bids, scopes of work, contracts, and change orders;</li>
        <li>Plan, coordinate, manage, document, and perform construction and related services;</li>
        <li>
          Communicate project schedules, progress, approvals, selections, delays, inspections, permits,
          invoices, safety matters, and other updates;
        </li>
        <li>
          Manage relationships with clients, prospects, contractors, subcontractors, designers, consultants,
          vendors, suppliers, and government authorities;
        </li>
        <li>
          Operate the CMI CRM, project portals, websites, forms, communication systems, and business
          applications;
        </li>
        <li>Verify identity, authenticate users, administer permissions, and secure accounts;</li>
        <li>Process invoices, payments, refunds, and accounting records;</li>
        <li>Provide customer service and technical support;</li>
        <li>Send service, account, project, and transactional communications;</li>
        <li>
          Send marketing or promotional communications when permitted by law and consistent with your
          choices;
        </li>
        <li>Maintain opt-in, opt-out, do-not-contact, and suppression records;</li>
        <li>
          Analyze and improve our services, operations, websites, applications, marketing, and client
          experience;
        </li>
        <li>Detect, investigate, and prevent fraud, misuse, security incidents, or unlawful activity;</li>
        <li>Enforce contracts, policies, and legal rights;</li>
        <li>
          Protect the health, safety, property, and rights of CMI, our clients, project participants, and the
          public;
        </li>
        <li>
          Comply with laws, regulations, court orders, subpoenas, licensing obligations, permitting
          requirements, inspections, audits, insurance requirements, and government requests; and
        </li>
        <li>
          Complete a business transaction such as a merger, financing, reorganization, sale, or transfer of
          assets.
        </li>
      </ul>

      <h2 id="text-messages-and-mobile-information">3. Text Messages and Mobile Information</h2>

      <p>CMI may use SMS or MMS messages for communications such as:</p>

      <ul>
        <li>Appointment and consultation reminders;</li>
        <li>Estimate, proposal, and follow-up communications;</li>
        <li>Project scheduling and status updates;</li>
        <li>Design selections, approvals, and documentation requests;</li>
        <li>Permit, inspection, access, delivery, and site-coordination updates;</li>
        <li>Invoice, payment, warranty, and service reminders;</li>
        <li>Client, contractor, subcontractor, vendor, and project-team coordination;</li>
        <li>Safety, delay, weather, or urgent project notices; and</li>
        <li>Marketing or promotional messages when you have provided the required consent.</li>
      </ul>

      <h3>3.1 SMS Consent</h3>

      <p>
        SMS consent is voluntary and is not a condition of purchasing goods or services, requesting an
        estimate, creating an account, or entering into a construction agreement. When CMI uses a website
        form to collect SMS consent, the SMS consent control should be separate from other required
        agreements and should not be preselected.
      </p>

      <p>Message frequency varies. Message and data rates may apply.</p>

      <p>
        You may opt out at any time by replying <strong>STOP</strong> to a CMI text message. You may also use
        other supported opt-out keywords such as{" "}
        <strong>STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, OPTOUT,</strong> or <strong>REVOKE</strong>. You may
        receive one final message confirming that your opt-out request has been processed. After that
        confirmation, CMI will not send additional SMS or MMS messages from that messaging program unless you
        provide new consent.
      </p>

      <p>
        Reply <strong>HELP</strong> for help or contact us at{" "}
        <a href="mailto:hello@constructedmatter.com">hello@constructedmatter.com</a> or{" "}
        <a href="tel:+14806284458">(480) 628-4458</a>.
      </p>

      <h3>3.2 No Sale or Marketing Sharing of Mobile Consent Data</h3>

      <div className="cmi-legal-note">
        <strong>
          CMI does not sell, rent, trade, or share mobile phone numbers, SMS opt-in data, or messaging
          consent information with third parties or affiliates for their own marketing or promotional
          purposes.
        </strong>
      </div>

      <p>
        We may disclose mobile information to service providers that help us operate our messaging program,
        CRM, customer support, scheduling, security, hosting, or communications systems. Those providers may
        use the information only to provide services to CMI, comply with law, or protect the service, and not
        for their own independent marketing.
      </p>

      <p>
        SMS opt-in data and consent will not be transferred to another organization except as necessary to
        provide the requested messaging service, comply with law, protect rights or safety, or complete a
        business transaction where the recipient agrees to honor this Privacy Policy and applicable consent
        restrictions.
      </p>

      <h2 id="email-communications">4. Email Communications</h2>

      <p>CMI may send:</p>

      <ul>
        <li>
          Transactional or relationship emails concerning inquiries, accounts, estimates, contracts,
          projects, invoices, appointments, warranties, safety, or services; and
        </li>
        <li>
          Marketing emails concerning CMI services, events, news, educational content, promotions, or
          opportunities.
        </li>
      </ul>

      <p>
        Marketing emails will include a clear method to unsubscribe. You may also opt out through{" "}
        <Link href={LEGAL_ROUTES.emailOptOut}>constructedmatter.com/email-opt-out</Link> or by contacting us.
        We will process marketing-email opt-out requests within the period required by applicable law.
        Opting out of marketing email does not necessarily stop transactional or project-related
        communications that are necessary to fulfill a request, administer an account, perform a contract,
        provide safety information, or comply with law.
      </p>

      <h2 id="telephone-calls-recordings-and-ai-assisted-communications">
        5. Telephone Calls, Recordings, and AI-Assisted Communications
      </h2>

      <p>
        CMI may communicate by telephone for inquiries, scheduling, project coordination, customer service,
        account administration, and business development.
      </p>

      <p>
        Where required, CMI will obtain consent before making marketing calls using an automatic telephone
        dialing system, an artificial or prerecorded voice, or an AI-generated voice. Consent to receive
        marketing calls is not a condition of purchase. You may revoke telephone marketing consent by telling
        us during a call, contacting us, or using another reasonable method.
      </p>

      <p>
        Calls may be recorded, transcribed, summarized, or assisted by automated or artificial-intelligence
        technologies for quality, training, documentation, security, scheduling, or customer-service purposes
        where permitted by law. When notice or consent is legally required, CMI will provide it.
      </p>

      <h2 id="how-we-disclose-information">6. How We Disclose Information</h2>

      <p>
        We may disclose information to the following categories of recipients for legitimate business
        purposes.
      </p>

      <h3>6.1 Project Participants</h3>

      <p>
        We may disclose relevant project information to clients, property owners, authorized
        representatives, employees, project managers, general contractors, subcontractors, designers,
        architects, engineers, consultants, vendors, suppliers, inspectors, utilities, homeowners&rsquo;
        associations, and other participants when reasonably necessary to evaluate, plan, coordinate,
        document, or perform a project.
      </p>

      <h3>6.2 Government and Regulatory Authorities</h3>

      <p>
        We may disclose information to cities, counties, states, federal agencies, permit authorities, zoning
        departments, inspectors, utilities, courts, law enforcement, licensing boards, or other governmental
        entities when necessary for applications, permits, inspections, compliance, public-record processes,
        legal obligations, or protection of rights and safety.
      </p>

      <h3>6.3 Service Providers</h3>

      <p>We may use service providers for:</p>

      <ul>
        <li>Website and application hosting;</li>
        <li>CRM and project-management systems;</li>
        <li>Cloud storage and databases;</li>
        <li>Email, SMS, voice, and customer communications;</li>
        <li>Scheduling, forms, and electronic signatures;</li>
        <li>Payment processing and accounting;</li>
        <li>Analytics, security, fraud prevention, and technical support;</li>
        <li>Document management, design, estimating, and construction operations; and</li>
        <li>Legal, insurance, auditing, and professional services.</li>
      </ul>

      <p>
        Service providers are authorized to use personal information only as needed to provide services to
        CMI or as permitted by law.
      </p>

      <h3>6.4 Professional Advisers and Insurers</h3>

      <p>
        We may disclose information to attorneys, accountants, auditors, consultants, insurance providers,
        sureties, claims administrators, and other professional advisers.
      </p>

      <h3>6.5 Business Transfers</h3>

      <p>
        Information may be disclosed or transferred as part of a merger, acquisition, financing,
        reorganization, bankruptcy, sale of assets, or similar transaction, subject to applicable law.
      </p>

      <h3>6.6 Legal, Safety, and Rights Protection</h3>

      <p>
        We may disclose information when we reasonably believe it is necessary to comply with law, respond to
        legal process, investigate misconduct, enforce an agreement, collect amounts owed, protect a
        person&rsquo;s safety, protect property, or defend CMI&rsquo;s rights.
      </p>

      <h2 id="cookies-and-similar-technologies">7. Cookies and Similar Technologies</h2>

      <p>
        CMI may use essential, functional, analytics, security, and preference technologies to operate and
        improve our websites and applications. Depending on the tools enabled on a particular CMI property,
        these technologies may remember preferences, maintain sessions, measure site usage, identify errors,
        prevent abuse, or support communications.
      </p>

      <p>
        Browser controls may allow you to block or delete cookies. Some features may not work properly if
        essential technologies are disabled.
      </p>

      <p>
        CMI should maintain a cookie or tracking notice that accurately reflects the tools actually deployed
        on each website or application.
      </p>

      <h2 id="project-photos-video-testimonials-and-marketing">
        8. Project Photos, Video, Testimonials, and Marketing
      </h2>

      <p>
        CMI may capture project documentation for estimating, design, coordination, quality control, safety,
        progress reporting, warranty, insurance, dispute resolution, and recordkeeping.
      </p>

      <p>
        CMI will obtain any permission required by law or contract before using identifiable client names,
        testimonials, private interior images, or other protected project content for public marketing. A
        construction contract, media release, project authorization, or separate consent may provide
        additional terms governing project photography or publicity.
      </p>

      <h2 id="data-retention">9. Data Retention</h2>

      <p>
        We retain personal information for as long as reasonably necessary for the purposes described in this
        Privacy Policy, including to:
      </p>

      <ul>
        <li>Maintain project, construction, permit, warranty, safety, and service records;</li>
        <li>Fulfill contracts and client requests;</li>
        <li>Manage ongoing business relationships;</li>
        <li>Maintain consent, opt-out, and suppression records;</li>
        <li>Comply with tax, accounting, licensing, insurance, legal, and regulatory obligations;</li>
        <li>Resolve disputes and enforce agreements; and</li>
        <li>Protect against fraud, claims, or security incidents.</li>
      </ul>

      <p>
        Retention periods vary based on the type of record, the project, legal requirements, contractual
        obligations, and legitimate business needs. When information is no longer required, we may delete,
        deidentify, or securely dispose of it.
      </p>

      <h2 id="security">10. Security</h2>

      <p>
        CMI uses reasonable administrative, technical, and physical safeguards designed to protect personal
        information. These measures may include access controls, authentication, encryption where
        appropriate, backups, logging, vendor controls, and security monitoring.
      </p>

      <p>
        No website, application, transmission, or storage system can be guaranteed to be completely secure.
        You are responsible for safeguarding your account credentials and promptly notifying CMI of suspected
        unauthorized access.
      </p>

      <h2 id="your-privacy-choices-and-rights">11. Your Privacy Choices and Rights</h2>

      <p>
        Depending on where you live and subject to applicable exceptions, you may have the right to:
      </p>

      <ul>
        <li>Request access to or confirmation of personal information we maintain about you;</li>
        <li>Request correction of inaccurate information;</li>
        <li>Request deletion of certain information;</li>
        <li>Request a portable copy of certain information;</li>
        <li>Restrict or object to certain processing;</li>
        <li>
          Opt out of certain targeted advertising, profiling, sale, or sharing activities where applicable;
        </li>
        <li>Withdraw consent for future processing when processing is based on consent; and</li>
        <li>Appeal a decision concerning a privacy request where required by law.</li>
      </ul>

      <p>
        CMI does not sell personal information for money. CMI also does not sell or share mobile phone
        numbers or messaging consent information for third-party marketing.
      </p>

      <p>
        To submit a privacy request, email{" "}
        <a href="mailto:hello@constructedmatter.com">hello@constructedmatter.com</a> with the subject line{" "}
        <strong>Privacy Request</strong> or write to the address below. We may need to verify your identity
        and authority before completing a request. Authorized agents may submit requests where permitted by
        law, subject to verification.
      </p>

      <p>You will not be discriminated against for exercising an applicable privacy right.</p>

      <h2 id="communication-preferences">12. Communication Preferences</h2>

      <p>You may manage communications as follows:</p>

      <ul>
        <li>
          <strong>SMS:</strong> Reply <strong>STOP</strong> to any CMI text or visit{" "}
          <Link href={LEGAL_ROUTES.smsOptOut}>constructedmatter.com/sms-opt-out</Link>.
        </li>
        <li>
          <strong>Email marketing:</strong> Use the unsubscribe link in the email or visit{" "}
          <Link href={LEGAL_ROUTES.emailOptOut}>constructedmatter.com/email-opt-out</Link>.
        </li>
        <li>
          <strong>Telephone marketing:</strong> Tell the caller that you revoke consent or contact CMI using
          the information below.
        </li>
        <li>
          <strong>Account or project notifications:</strong> Contact your project representative or CMI
          support. Some essential communications may be required to administer an active project, account,
          safety matter, invoice, or legal obligation.
        </li>
      </ul>

      <p>
        We may retain limited suppression-list information to ensure that your opt-out preference is honored.
      </p>

      <h2 id="childrens-privacy">13. Children&rsquo;s Privacy</h2>

      <p>
        CMI&rsquo;s websites, applications, and services are intended for adults and business users. They are
        not directed to children under 13, and CMI does not knowingly collect personal information directly
        from children under 13 without appropriate authorization. Contact us if you believe a child has
        submitted personal information improperly.
      </p>

      <h2 id="third-party-websites-and-services">14. Third-Party Websites and Services</h2>

      <p>
        CMI websites and applications may link to third-party services. CMI is not responsible for the
        privacy, security, or content practices of third parties. Review their policies before providing
        information.
      </p>

      <h2 id="changes-to-this-privacy-policy">15. Changes to This Privacy Policy</h2>

      <p>
        We may update this Privacy Policy periodically. The &ldquo;Last Updated&rdquo; date identifies the
        latest revision. Material changes may be communicated through the website, application, email, or
        another appropriate method.
      </p>

      <h2 id="contact-us">16. Contact Us</h2>

      <p>For privacy questions, requests, or complaints, contact:</p>

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
        <br />
        Website:{" "}
        <a href="https://constructedmatter.com" target="_blank" rel="noreferrer">
          https://constructedmatter.com
        </a>
      </p>
    </LegalPageLayout>
  );
}
