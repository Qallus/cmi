import Link from "next/link";
import { LegalPageLayout, LEGAL_ROUTES } from "@/components/legal/legal-page";

export const metadata = {
  title: "Terms of Service — Constructed Matter, Inc.",
  description:
    "The terms governing access to and use of the websites, portals, applications, forms, communications, and other online services operated by Constructed Matter, Inc.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      effectiveDate="July 22, 2026"
      currentHref={LEGAL_ROUTES.terms}
      intro={
        "These Terms of Service (“Terms”) govern access to and use of the websites, portals, applications, forms, communications, and other online services operated by Constructed Matter, Inc. (“Constructed Matter,” “CMI,” “we,” “us,” or “our”), including constructedmatter.com, my.constructedmatter.com, and the CMI customer relationship management and project-management systems (collectively, the “Online Services”)."
      }
    >
      <p>
        <strong>Last Updated:</strong> July 22, 2026
      </p>

      <p>
        By accessing or using the Online Services, creating an account, submitting information, or clicking
        to accept these Terms, you agree to these Terms and the CMI{" "}
        <Link href={LEGAL_ROUTES.privacy}>Privacy Policy</Link>.
      </p>

      <h2 id="important-relationship-to-construction-agreements">
        1. Important Relationship to Construction Agreements
      </h2>

      <p>
        The Online Services support CMI&rsquo;s construction, remodeling, design coordination, consulting,
        estimating, project-management, and related business activities.
      </p>

      <div className="cmi-legal-note">
        <strong>
          These Terms do not replace a signed construction contract, professional-services agreement,
          subcontract, purchase order, proposal, scope of work, change order, warranty, media release, or
          other project-specific agreement.
        </strong>
      </div>

      <p>
        If these Terms conflict with a signed project-specific agreement, the signed project-specific
        agreement controls for that project. Website descriptions, preliminary estimates, scheduling
        information, portal content, marketing materials, and general communications do not create a binding
        construction obligation unless expressly incorporated into a signed agreement.
      </p>

      <h2 id="eligibility-and-authority">2. Eligibility and Authority</h2>

      <p>
        You must be at least 18 years old and legally capable of entering into an agreement to use the Online
        Services.
      </p>

      <p>
        If you use the Online Services for a company, agency, property owner, contractor, subcontractor,
        vendor, designer, consultant, municipality, county, state, or another organization, you represent
        that you are authorized to act for that entity and bind it to these Terms.
      </p>

      <h2 id="permitted-use">3. Permitted Use</h2>

      <p>You may use the Online Services for legitimate purposes such as:</p>

      <ul>
        <li>Requesting information, estimates, consultations, or services;</li>
        <li>Scheduling appointments, meetings, inspections, or site visits;</li>
        <li>Reviewing or exchanging project information;</li>
        <li>Communicating with CMI and authorized project participants;</li>
        <li>
          Managing tasks, files, selections, approvals, invoices, bids, proposals, or project records;
        </li>
        <li>
          Accessing a client, contractor, subcontractor, vendor, consultant, or staff portal; and
        </li>
        <li>Participating in an authorized CMI business or project workflow.</li>
      </ul>

      <p>
        You agree to provide accurate, current, and complete information and to update it when necessary.
      </p>

      <h2 id="accounts-and-security">4. Accounts and Security</h2>

      <p>You are responsible for:</p>

      <ul>
        <li>Maintaining the confidentiality of your credentials;</li>
        <li>Limiting account access to authorized users;</li>
        <li>Using accurate identity and organization information;</li>
        <li>Promptly notifying CMI of suspected unauthorized access;</li>
        <li>Complying with assigned roles, permissions, and project restrictions; and</li>
        <li>
          All actions taken through your account unless caused by CMI&rsquo;s failure to use reasonable
          security.
        </li>
      </ul>

      <p>
        CMI may suspend or terminate an account when it is inactive, compromised, used improperly, or no
        longer required.
      </p>

      <h2 id="estimates-proposals-scheduling-and-project-information">
        5. Estimates, Proposals, Scheduling, and Project Information
      </h2>

      <p>Unless otherwise stated in a signed agreement:</p>

      <ul>
        <li>Website content and preliminary estimates are informational and may change;</li>
        <li>
          Pricing is not final until documented in an accepted proposal, contract, purchase order, or change
          order;
        </li>
        <li>
          Availability and schedules are estimates and may be affected by permitting, inspections, weather,
          labor, materials, owner decisions, concealed conditions, utility coordination, government action,
          force majeure, and other factors;
        </li>
        <li>
          Submission of a form does not guarantee acceptance of a project or the availability of services;
        </li>
        <li>A requested appointment is not confirmed until CMI provides confirmation; and</li>
        <li>Project portal information may be updated as work progresses.</li>
      </ul>

      <p>
        Clients and project participants are responsible for reviewing submissions, plans, selections,
        approvals, schedules, invoices, and notices promptly.
      </p>

      <h2 id="client-and-project-responsibilities">6. Client and Project Responsibilities</h2>

      <p>
        Depending on the project and signed agreement, clients and authorized representatives may be
        responsible for:
      </p>

      <ul>
        <li>Providing accurate property, ownership, access, and project information;</li>
        <li>
          Disclosing known conditions, hazards, restrictions, easements, association requirements, or
          occupancy concerns;
        </li>
        <li>
          Providing timely decisions, selections, approvals, documents, payments, and access;
        </li>
        <li>Ensuring that submitted content may lawfully be shared and used;</li>
        <li>Identifying authorized decision-makers and communication contacts;</li>
        <li>Following site-safety, access, and scheduling instructions; and</li>
        <li>Obtaining approvals or permissions assigned to them under a project agreement.</li>
      </ul>

      <p>Additional responsibilities may be stated in the applicable project contract.</p>

      <h2 id="contractors-subcontractors-vendors-and-professional-participants">
        7. Contractors, Subcontractors, Vendors, and Professional Participants
      </h2>

      <p>
        Contractors, subcontractors, tradespeople, designers, architects, engineers, consultants, vendors,
        suppliers, and other project participants must:
      </p>

      <ul>
        <li>
          Provide accurate business, licensing, insurance, tax, qualification, and contact information;
        </li>
        <li>Maintain required licenses, insurance, certifications, and authorizations;</li>
        <li>
          Comply with project requirements, laws, codes, safety rules, contracts, and professional standards;
        </li>
        <li>Protect confidential client and project information;</li>
        <li>Use CMI systems only for authorized work; and</li>
        <li>
          Promptly report material changes affecting eligibility, availability, safety, or performance.
        </li>
      </ul>

      <p>
        Access to a CMI system does not create employment, agency, partnership, joint venture, or guaranteed
        work.
      </p>

      <h2 id="user-content-and-project-materials">8. User Content and Project Materials</h2>

      <p>
        &ldquo;User Content&rdquo; includes information, messages, files, photos, videos, audio, plans,
        drawings, specifications, measurements, selections, comments, approvals, and other materials you
        submit to the Online Services.
      </p>

      <p>
        You retain ownership of your User Content, subject to rights held by others. You grant CMI a
        nonexclusive, worldwide, royalty-free license to host, store, copy, display, transmit, format,
        process, and use User Content as reasonably necessary to:
      </p>

      <ul>
        <li>Provide and administer the Online Services;</li>
        <li>Evaluate, estimate, plan, coordinate, document, or perform a project;</li>
        <li>Communicate with authorized project participants;</li>
        <li>Maintain project, warranty, safety, insurance, and legal records;</li>
        <li>Improve security and system performance; and</li>
        <li>Comply with law and enforce agreements.</li>
      </ul>

      <p>
        You represent that you have the rights and permissions needed to submit User Content and authorize
        its use for these purposes.
      </p>

      <p>
        Public marketing use of identifiable client testimonials, private interior imagery, or protected
        project materials is subject to the applicable contract, release, permission, and law.
      </p>

      <h2 id="intellectual-property">9. Intellectual Property</h2>

      <p>
        The Online Services, including CMI branding, logos, software, interface designs, text, graphics,
        workflows, templates, databases, and original content, are owned by or licensed to CMI and are
        protected by intellectual-property laws.
      </p>

      <p>
        Except as expressly permitted, you may not copy, reproduce, modify, publish, distribute, sell,
        license, reverse engineer, scrape, or create derivative works from the Online Services.
      </p>

      <p>
        Project-specific ownership and license rights for drawings, renderings, models, designs,
        photographs, specifications, or other deliverables may be governed by a separate agreement.
      </p>

      <h2 id="privacy">10. Privacy</h2>

      <p>
        CMI&rsquo;s collection and use of personal information are described in the Privacy Policy available
        at:
      </p>

      <p>
        <Link href={LEGAL_ROUTES.privacy}>constructedmatter.com/privacy-policy</Link>
      </p>

      <p>
        Mobile phone numbers, SMS opt-in data, and messaging consent information are not sold, rented, or
        shared with third parties or affiliates for their own marketing or promotional purposes.
      </p>

      <h2 id="electronic-communications">11. Electronic Communications</h2>

      <p>
        You agree that CMI may provide notices and communications electronically, including through email,
        text message, portal notification, electronic signature platform, or website posting, where permitted
        by law.
      </p>

      <p>
        You are responsible for maintaining current contact information and reviewing communications sent to
        the contact information associated with your inquiry, account, organization, or project.
      </p>

      <h2 id="sms-and-mms-messaging-terms">12. SMS and MMS Messaging Terms</h2>

      <h3>12.1 Program Description</h3>

      <p>
        The <strong>Constructed Matter Communications Program</strong> may send SMS or MMS messages
        concerning:
      </p>

      <ul>
        <li>Inquiries and estimate follow-ups;</li>
        <li>Consultation, appointment, and meeting reminders;</li>
        <li>Project schedules, milestones, status, delays, access, and coordination;</li>
        <li>Design selections, approvals, documents, and action items;</li>
        <li>Permits, inspections, utilities, deliveries, and site activity;</li>
        <li>Invoices, payments, warranties, and service requests;</li>
        <li>Client, contractor, subcontractor, vendor, and project-team communications;</li>
        <li>Safety, weather, emergency, or urgent project notices; and</li>
        <li>
          CMI news, events, educational content, services, offers, or promotions when you separately consent
          to marketing messages.
        </li>
      </ul>

      <h3>12.2 Consent</h3>

      <p>
        Your consent to receive SMS or MMS messages is voluntary. Consent is not a condition of purchasing
        goods or services, obtaining an estimate, creating an account, or entering into an agreement with
        CMI.
      </p>

      <p>
        Service or project-message consent and marketing-message consent may be requested separately. Consent
        applies only to the message categories, CMI program, and mobile number identified at the time of
        opt-in.
      </p>

      <h3>12.3 Frequency and Charges</h3>

      <p>
        Message frequency varies based on your relationship with CMI, active projects, requests,
        appointments, and communication choices.
      </p>

      <p>
        <strong>Message and data rates may apply.</strong> Your carrier&rsquo;s terms govern charges and
        delivery.
      </p>

      <h3>12.4 Opt-Out</h3>

      <p>
        You may opt out at any time by replying <strong>STOP</strong>. Supported opt-out keywords may also
        include <strong>STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, OPTOUT,</strong> and{" "}
        <strong>REVOKE</strong>.
      </p>

      <p>
        CMI may send one final confirmation message after processing an opt-out. No additional messages will
        be sent from that messaging program unless you provide new consent.
      </p>

      <p>
        Opting out of SMS does not cancel a contract, project, appointment, invoice, or account. CMI may use
        another lawful communication method for essential business or project matters.
      </p>

      <h3>12.5 Help and Support</h3>

      <p>
        Reply <strong>HELP</strong> for help.
      </p>

      <p>You may also contact:</p>

      <ul>
        <li>
          Phone: <a href="tel:+14806284458">(480) 628-4458</a>
        </li>
        <li>
          Email: <a href="mailto:info@constructedmatter.com">info@constructedmatter.com</a>
        </li>
        <li>
          SMS opt-out page:{" "}
          <Link href={LEGAL_ROUTES.smsOptOut}>constructedmatter.com/sms-opt-out</Link>
        </li>
      </ul>

      <h3>12.6 Delivery</h3>

      <p>
        Wireless carriers are not liable for delayed or undelivered messages. Delivery is subject to carrier
        availability, device compatibility, network conditions, and other factors outside CMI&rsquo;s
        control.
      </p>

      <h3>12.7 Mobile Privacy</h3>

      <p>
        CMI does not sell, rent, or share mobile phone numbers or messaging consent data with third parties
        or affiliates for their own marketing or promotional purposes. See the{" "}
        <Link href={LEGAL_ROUTES.privacy}>Privacy Policy</Link> for additional information.
      </p>

      <h2 id="email-communications">13. Email Communications</h2>

      <p>CMI may send transactional, relationship, project, account, and marketing emails.</p>

      <p>Marketing emails will include an unsubscribe method. You may also visit:</p>

      <p>
        <Link href={LEGAL_ROUTES.emailOptOut}>constructedmatter.com/email-opt-out</Link>
      </p>

      <p>
        CMI may continue sending non-marketing emails reasonably necessary to administer an inquiry,
        transaction, contract, active project, invoice, warranty, account, safety matter, legal obligation,
        or requested service.
      </p>

      <h2 id="telephone-and-ai-assisted-calls">14. Telephone and AI-Assisted Calls</h2>

      <p>
        CMI may call you concerning inquiries, scheduling, estimates, projects, accounts, customer service,
        or business relationships.
      </p>

      <p>
        Where required by law, CMI will obtain separate consent before placing marketing calls using
        automated dialing technology, an artificial or prerecorded voice, or an AI-generated voice. Such
        marketing consent is not a condition of purchase.
      </p>

      <p>
        Calls may be recorded, transcribed, summarized, routed, or assisted by automated or
        artificial-intelligence technologies where permitted by law and after any legally required notice or
        consent.
      </p>

      <p>
        You may revoke marketing-call consent through any reasonable method, including telling the caller or
        contacting CMI.
      </p>

      <h2 id="acceptable-use">15. Acceptable Use</h2>

      <p>You may not:</p>

      <ul>
        <li>Use the Online Services unlawfully, fraudulently, deceptively, or abusively;</li>
        <li>Impersonate another person or misrepresent authority;</li>
        <li>Upload malware, destructive code, or content that compromises security;</li>
        <li>
          Probe, scan, test, or circumvent security or access controls without written authorization;
        </li>
        <li>Interfere with the operation of the Online Services;</li>
        <li>Harvest, scrape, or collect information about other users without permission;</li>
        <li>
          Submit content that infringes intellectual-property, privacy, publicity, contractual, or other
          rights;
        </li>
        <li>Use project or contact information for unauthorized solicitation;</li>
        <li>
          Transmit threatening, harassing, defamatory, discriminatory, obscene, or unlawful content;
        </li>
        <li>
          Expose confidential project, client, employee, vendor, or government information without
          authorization; or
        </li>
        <li>
          Use automated methods to access the Online Services except through an authorized integration.
        </li>
      </ul>

      <h2 id="third-party-services-and-integrations">16. Third-Party Services and Integrations</h2>

      <p>
        The Online Services may use or connect to third-party systems for hosting, databases, CRM,
        scheduling, forms, payments, communications, maps, analytics, signatures, file storage, design,
        estimating, permitting, or project management.
      </p>

      <p>
        Third-party services may have separate terms and privacy policies. CMI is not responsible for a third
        party&rsquo;s independent services, outages, security, or content, except to the extent required by
        law or contract.
      </p>

      <h2 id="no-professional-advice-through-general-website-content">
        17. No Professional Advice Through General Website Content
      </h2>

      <div className="cmi-legal-note">
        <p>
          General website, blog, AI-agent, chatbot, or portal content is for informational and administrative
          purposes. It is not a substitute for:
        </p>

        <ul>
          <li>A signed construction agreement;</li>
          <li>Site-specific architectural or engineering services;</li>
          <li>Legal, tax, accounting, insurance, environmental, or financial advice;</li>
          <li>A government determination, permit, inspection, or code interpretation; or</li>
          <li>A qualified professional&rsquo;s site-specific evaluation.</li>
        </ul>

        <p>Users should consult the appropriate licensed or qualified professional.</p>
      </div>

      <h2 id="availability-and-changes">18. Availability and Changes</h2>

      <p>
        CMI may modify, suspend, restrict, or discontinue any part of the Online Services. We do not
        guarantee continuous, uninterrupted, or error-free availability.
      </p>

      <p>
        CMI may update these Terms. Changes become effective when posted unless a later date is stated.
        Material changes may be communicated through the Online Services or another reasonable method.
      </p>

      <h2 id="disclaimers">19. Disclaimers</h2>

      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE ONLINE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND
        &ldquo;AS AVAILABLE.&rdquo;
      </p>

      <p>
        CMI DISCLAIMS IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
        NON-INFRINGEMENT, TITLE, AND ANY WARRANTY ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.
      </p>

      <p>
        CMI DOES NOT WARRANT THAT ONLINE CONTENT IS COMPLETE, CURRENT, ERROR-FREE, SECURE, OR SUITABLE FOR A
        PARTICULAR PROJECT. WARRANTIES CONCERNING CONSTRUCTION WORK OR DELIVERABLES, IF ANY, ARE GOVERNED BY
        THE APPLICABLE SIGNED PROJECT AGREEMENT AND LAW.
      </p>

      <p>
        Some jurisdictions do not allow certain disclaimers, so portions of this section may not apply.
      </p>

      <h2 id="limitation-of-liability">20. Limitation of Liability</h2>

      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, CMI AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND
        SERVICE PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
        PUNITIVE DAMAGES ARISING FROM THE ONLINE SERVICES, INCLUDING LOSS OF DATA, PROFITS, BUSINESS,
        GOODWILL, OR OPPORTUNITY.
      </p>

      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, CMI&rsquo;S TOTAL LIABILITY ARISING FROM THE ONLINE SERVICES
        WILL NOT EXCEED THE GREATER OF:
      </p>

      <ol>
        <li>
          THE AMOUNT YOU PAID CMI SPECIFICALLY FOR THE ONLINE SERVICE GIVING RISE TO THE CLAIM DURING THE SIX
          MONTHS BEFORE THE EVENT; OR
        </li>
        <li>ONE HUNDRED U.S. DOLLARS.</li>
      </ol>

      <p>
        This limitation does not alter liability or remedies established by a signed construction contract
        and does not apply where prohibited by law.
      </p>

      <h2 id="indemnification">21. Indemnification</h2>

      <p>
        To the extent permitted by law, you agree to indemnify and hold harmless CMI and its officers,
        directors, employees, and agents from claims, losses, liabilities, damages, and reasonable expenses
        arising from:
      </p>

      <ul>
        <li>Your unlawful or unauthorized use of the Online Services;</li>
        <li>Your breach of these Terms;</li>
        <li>User Content you submit;</li>
        <li>Your infringement of another party&rsquo;s rights; or</li>
        <li>Your misrepresentation of authority.</li>
      </ul>

      <p>
        This section does not apply to the extent a claim results from CMI&rsquo;s own conduct for which
        indemnification cannot lawfully be required.
      </p>

      <h2 id="suspension-and-termination">22. Suspension and Termination</h2>

      <p>
        CMI may suspend or terminate access to the Online Services when reasonably necessary to:
      </p>

      <ul>
        <li>Protect users, systems, projects, or data;</li>
        <li>Investigate suspected misconduct;</li>
        <li>Enforce these Terms or another agreement;</li>
        <li>Comply with law or a government request;</li>
        <li>Address nonpayment or an inactive relationship; or</li>
        <li>Discontinue a service.</li>
      </ul>

      <p>
        Provisions that by their nature should survive termination will survive, including
        intellectual-property, disclaimer, limitation-of-liability, indemnification, and governing-law
        provisions.
      </p>

      <h2 id="governing-law-and-venue">23. Governing Law and Venue</h2>

      <p>
        These Terms are governed by the laws of the State of Arizona, without regard to conflict-of-law
        rules.
      </p>

      <p>
        Unless a signed project agreement provides otherwise, any court proceeding concerning these Terms or
        the Online Services must be brought in a state or federal court with jurisdiction in Maricopa County,
        Arizona. Each party consents to personal jurisdiction and venue in those courts.
      </p>

      <h2 id="miscellaneous">24. Miscellaneous</h2>

      <p>
        If a provision of these Terms is held unenforceable, it will be modified to the minimum extent
        necessary, and the remaining provisions will remain effective.
      </p>

      <p>CMI&rsquo;s failure to enforce a provision is not a waiver.</p>

      <p>
        You may not assign these Terms without CMI&rsquo;s written consent. CMI may assign these Terms in
        connection with a merger, reorganization, financing, sale of assets, or similar transaction.
      </p>

      <p>
        These Terms, the Privacy Policy, and any applicable signed agreement constitute the relevant
        agreement concerning the Online Services.
      </p>

      <h2 id="contact">25. Contact</h2>

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
        <br />
        Website:{" "}
        <a href="https://constructedmatter.com" target="_blank" rel="noreferrer">
          https://constructedmatter.com
        </a>
      </p>
    </LegalPageLayout>
  );
}
