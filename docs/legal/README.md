# Constructed Matter Legal and Communications Compliance Package

**Prepared for:** Constructed Matter, Inc.  
**Prepared:** July 22, 2026  
**Purpose:** Website legal-page content and implementation guidance aligned with current Twilio A2P 10DLC messaging requirements and U.S. commercial-email practices.

## Included Files

1. `privacy-policy.md`
   - Public URL: `https://constructedmatter.com/privacy-policy`

2. `terms-of-service.md`
   - Public URL: `https://my.constructedmatter.com/terms-of-service`

3. `sms-opt-in.md`
   - Public URL: `https://constructedmatter.com/sms-opt-in`

4. `sms-opt-out.md`
   - Public URL: `https://constructedmatter.com/sms-opt-out`

5. `email-opt-in.md`
   - Public URL: `https://constructedmatter.com/email-opt-in`

6. `email-opt-out.md`
   - Public URL: `https://constructedmatter.com/email-opt-out`

7. `cmi-a2p-10dlc-implementation.md`
   - Internal implementation checklist, campaign-flow copy, form requirements, and sample messages.

## Important Legal Note

These files are a practical compliance-oriented draft, not legal advice. Privacy, construction, contracting, telemarketing, call-recording, licensing, employment, payment, consumer-protection, and state privacy laws vary.

Before publication, CMI should have qualified legal counsel review:

- The governing-law and liability sections;
- The exact communications CMI will send;
- Every SMS, email, telephone, and AI-voice opt-in path;
- Call-recording and AI-voice disclosures;
- State-specific construction and consumer-contract requirements;
- Privacy rights applicable to CMI’s size, data practices, and service areas;
- The actual cookies, analytics, advertising, and integrations installed; and
- Any project photography, media-release, background-check, payment, or government-record practices.

## Publication Checklist

- Publish every page at the exact public URL submitted to Twilio.
- Do not put the Privacy Policy, Terms, or SMS opt-in behind a login.
- Add persistent Privacy and Terms links in the website footer.
- Add Privacy and Terms links directly beside every SMS consent checkbox.
- Keep SMS consent separate from acceptance of required Terms.
- Leave every SMS marketing checkbox unchecked by default.
- Allow users to complete the primary form without giving SMS marketing consent.
- Use separate consent controls for project/service SMS and marketing SMS.
- Do not use purchased, rented, scraped, or transferred SMS consent.
- Preserve the exact disclosure text shown when consent is captured.
- Synchronize opt-outs across Twilio, the CMI CRM, staff workflows, and other messaging tools.
- Test STOP, HELP, opt-in confirmation, opt-out confirmation, and suppression behavior before registration.
- Ensure all sample campaign messages identify “Constructed Matter” or “CMI.”
- Ensure the first recurring SMS includes “Reply STOP to unsubscribe” or equivalent.
- Add CMI’s valid physical postal address and unsubscribe link to commercial emails.
- Process commercial-email opt-outs within 10 business days and keep the mechanism active for at least 30 days after sending.
- Review the policies whenever the CRM, AI agent, messaging vendor, website analytics, or business use changes.

## Content Validation Required Before Launch

Confirm these details:

- Main business phone: `(480) 628-4458`
- Messaging number used for Twilio SMS: `[CONFIRM BEFORE PUBLISHING OR A2P SUBMISSION]`
- Support email: `hello@constructedmatter.com`
- Address: `7314 E Osborn Dr, Suite A, Scottsdale, AZ 85251`
- Exact legal entity name and Arizona corporate status
- Whether CMI records calls
- Whether CMI uses AI-generated or cloned voices
- Whether CMI performs automated outbound marketing calls
- Whether CMI uses advertising pixels or targeted-advertising tools
- Whether payment-card data is processed only by third-party processors
- Exact CRM, email, SMS, voice, analytics, and hosting providers
- Whether project images are used in marketing and how permission is obtained

## Recommended Consent Architecture

CMI should maintain distinct preference fields, not one general “contact me” field:

- `sms_service_consent`
- `sms_marketing_consent`
- `email_service_preference`
- `email_marketing_consent`
- `marketing_call_consent`
- `ai_or_prerecorded_call_consent`
- `call_recording_acknowledgment`
- `do_not_sms`
- `do_not_email_marketing`
- `do_not_call`
- `consent_disclosure_version`
- `consent_source_url`
- `consent_timestamp`
- `consent_ip`
- `consent_user_agent`
- `consent_form_submission_id`
- `opt_out_timestamp`
- `opt_out_source`
- `opt_out_keyword_or_method`

Do not infer SMS marketing consent from:

- A phone number entered for a quote;
- A signed construction contract unless it contains legally sufficient, separate consent;
- A business card;
- A prior phone call;
- An email subscription;
- A customer’s account creation;
- A referral;
- A purchased or shared lead list; or
- The absence of an opt-out.

See `cmi-a2p-10dlc-implementation.md` for detailed implementation copy.
