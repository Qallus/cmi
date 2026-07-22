# CMI A2P 10DLC and Communications Implementation Guide

**Internal Use — Do Not Publish as a Legal Page Without Editing**

## 1. Recommended Twilio Campaign Use Case

CMI’s campaign may include a mix of customer care, account notifications, appointment reminders, project coordination, and marketing. The campaign use case selected in Twilio must accurately match actual traffic.

Do not label promotional traffic as purely customer care.

## 2. Website SMS Message Flow for Twilio Submission

Replace the messaging number placeholder before submitting.

> End users opt in by visiting https://constructedmatter.com/sms-opt-in and entering their name and mobile number. The page provides two separate, optional, unchecked consent boxes. The first allows users to agree to recurring service and project-related SMS/MMS messages from Constructed Matter, Inc., including inquiry follow-ups, estimates, appointments, scheduling, project status, selections, permits, inspections, invoices, warranties, and safety or site-coordination messages. The second allows users to expressly agree to recurring marketing and promotional SMS/MMS messages from Constructed Matter, Inc. The user may submit other CMI forms or obtain services without selecting the marketing consent box. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of purchase. Terms: https://my.constructedmatter.com/terms-of-service. Privacy: https://constructedmatter.com/privacy-policy. The Privacy Policy states that mobile numbers and messaging consent are not sold or shared with third parties or affiliates for their own marketing.

## 3. Form Requirements

Every form that collects a mobile number should distinguish between:

1. A phone number needed to answer the request; and
2. Optional consent to receive recurring SMS.

### Required Form Behavior

- SMS checkbox is not preselected.
- SMS marketing consent is not required to submit a quote, contact, booking, account, employment, vendor, or project form.
- Terms acceptance is separate from SMS consent.
- The full disclosure is visible near the checkbox, not hidden only in a tooltip.
- Privacy and Terms links are clickable and public.
- The system records the full disclosure version presented.
- A validation error must not force SMS consent.
- Do not combine email, SMS, and telephone marketing into one checkbox.

## 4. Suggested Standalone Marketing-Call Consent

Use a separate, unchecked checkbox when CMI intends to make outbound marketing calls using automated technology or an artificial, prerecorded, or AI-generated voice.

`[ ] Yes, I agree that Constructed Matter, Inc. may call the telephone number I provided for marketing or promotional purposes, including calls made using automated dialing technology or an artificial, prerecorded, or AI-generated voice. Consent is not a condition of purchase. I may revoke consent at any time through any reasonable method.`

Legal counsel should approve this language and the exact call workflow before use.

## 5. Suggested SMS System Messages

Replace `[CMI NUMBER]` or other placeholders before deployment.

### Opt-In Confirmation — Service and Project

> Constructed Matter: You’re subscribed to service and project texts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.

### Opt-In Confirmation — Marketing

> Constructed Matter: You’re subscribed to marketing texts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.

### HELP Response

> Constructed Matter: For help, call (480) 628-4458 or email hello@constructedmatter.com. Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel.

### STOP Confirmation

> Constructed Matter: You have been unsubscribed and will receive no further messages from this program. Contact (480) 628-4458 for assistance.

### Re-Opt-In

Do not resume SMS merely because a user replies with an unrelated message after opting out. Require a supported re-opt-in keyword or a new documented opt-in through the public page.

## 6. Sample A2P Campaign Messages

### Appointment Reminder

> Constructed Matter: Reminder—your consultation is scheduled for [DATE] at [TIME]. Reply C to confirm or call (480) 628-4458. Reply STOP to unsubscribe.

### Project Update

> Constructed Matter: Project update for [PROJECT]: [SHORT UPDATE]. View details in your CMI portal or contact your project manager. Reply STOP to unsubscribe.

### Selection Needed

> Constructed Matter: A selection or approval is needed for [PROJECT ITEM] by [DATE] to help maintain the schedule. Sign in to your CMI portal for details. Reply STOP to unsubscribe.

### Inspection or Permit Update

> Constructed Matter: [PERMIT/INSPECTION] for [PROJECT] is scheduled or updated for [DATE]. We’ll send another update if the timing changes. Reply STOP to unsubscribe.

### Marketing Message

> Constructed Matter: Planning a remodel, addition, ADU, or new construction project? Learn how CMI can help: [LINK]. Msg frequency varies. Reply STOP to unsubscribe.

## 7. Consent Evidence to Store in the CMI CRM

For each consent event, store:

- Person or contact record;
- Mobile number in E.164 format;
- Consent category;
- Exact checkbox text or disclosure version;
- Date and time with timezone;
- Source page URL;
- Form or record ID;
- IP address;
- Browser or user-agent data where appropriate;
- Staff user if consent was entered from an offline form;
- A copy or screenshot of the form version;
- Method such as web form, paper form, QR code, SMS keyword, or verbal consent;
- The specific message program and brand;
- Confirmation-message status; and
- Any later revocation, suppression, or re-consent record.

Keep historical consent and revocation records. Do not overwrite the original record.

## 8. Offline, Paper, Event, or QR-Code Consent

If CMI collects SMS consent at a meeting, jobsite, event, trade show, printed form, or QR code:

- Use the same required disclosures;
- Keep consent optional;
- Use a separate unchecked box or clear affirmative signature/initial action;
- Include Privacy and Terms URLs in readable form;
- Host a publicly accessible screenshot or sample of the offline form if needed for Twilio review;
- Describe every active opt-in path in the Twilio campaign submission; and
- Record the staff member, date, location, and disclosure version.

A QR code should lead directly to the public SMS Opt-In page rather than silently enrolling the user.

## 9. Verbal Consent

Verbal consent can be difficult to verify and may not be appropriate for promotional traffic without a carefully designed workflow.

If used for service or project notifications:

- Use an approved script;
- Confirm the mobile number;
- State the CMI brand;
- Identify the message categories;
- State frequency varies;
- State message and data rates may apply;
- Explain STOP and HELP;
- Clarify that consent is not a condition of purchase;
- Document the date, time, employee, script version, and call record; and
- Send a compliant confirmation only after valid consent.

Obtain legal review before relying on verbal consent for marketing.

## 10. Opt-Out Handling

CMI must treat reasonable revocation requests seriously, even when the user does not use the exact word STOP.

### System Rules

- Twilio STOP keywords immediately suppress the sender/program.
- Sync suppression to the CMI CRM.
- Prevent staff from manually sending SMS to suppressed contacts.
- Cancel scheduled SMS jobs.
- Suppress automated agent, workflow, and bulk-campaign messages.
- Allow only one final confirmation.
- Keep the opt-out record.
- Do not ask the user to explain why.
- Do not charge a fee.
- Do not require account login.
- New SMS can begin only after new valid consent.

### Natural-Language Requests to Treat as Revocation

Examples include:

- “Stop texting me.”
- “Don’t message this number.”
- “Take me off your text list.”
- “No more texts.”
- “Remove my number.”

Route uncertain replies to a human and pause messaging while reviewed.

## 11. Email Compliance Checklist

Commercial email should:

- Use accurate From, To, Reply-To, and routing information;
- Use a truthful subject line;
- Clearly identify CMI;
- Disclose advertising status when required;
- Include CMI’s valid physical postal address;
- Include a clear unsubscribe method;
- Provide an option to stop all marketing email;
- Keep the opt-out method available for at least 30 days after sending;
- Honor requests within 10 business days;
- Avoid requiring a login, fee, or information beyond the email address;
- Suppress unsubscribed addresses across all marketing systems; and
- Monitor vendors and platforms sending on CMI’s behalf.

Transactional email should not be disguised promotional email. Keep the primary purpose transactional when relying on the transactional-message category.

## 12. Telephone and AI-Voice Controls

Before using outbound automated or AI-assisted calls:

- Separate customer-service calls from marketing calls;
- Obtain legally sufficient consent for covered marketing calls;
- Identify Constructed Matter at the beginning of the call;
- Disclose recording when required;
- Disclose an artificial or AI-generated voice when required;
- Maintain a company-specific do-not-call list;
- Scrub applicable national and state do-not-call lists where required;
- Honor revocation through any reasonable method;
- Apply calling-time restrictions;
- Maintain consent and call-disposition records; and
- Obtain legal review for multi-state campaigns.

## 13. Privacy and Vendor Controls

CMI should execute appropriate agreements with providers handling personal information, including CRM, hosting, SMS, voice, email, scheduling, forms, payments, analytics, AI, storage, and project-management vendors.

Vendor access should be limited to what is needed to provide the service.

Mobile phone numbers and SMS consent information must not be provided to third parties or affiliates for their own marketing.

## 14. A2P Pre-Submission Test

Before submitting or resubmitting:

1. Open every submitted URL in a private/incognito browser.
2. Confirm no login is required.
3. Confirm CMI branding is visible.
4. Confirm Privacy and Terms links work.
5. Confirm mobile-number non-sharing language is present.
6. Confirm message frequency and message/data-rate disclosures are present.
7. Confirm checkboxes are unchecked.
8. Confirm SMS consent is optional.
9. Submit a test opt-in.
10. Verify the consent record in the CRM.
11. Verify the confirmation SMS identifies Constructed Matter.
12. Send HELP and verify the response.
13. Send STOP and verify one confirmation only.
14. Verify the contact is suppressed in every workflow.
15. Verify a staff user cannot bypass the suppression accidentally.
16. Confirm campaign sample messages match actual traffic.
17. Confirm every opt-in path is described in the Twilio message-flow field.
18. Confirm the messaging number is attached to the approved Messaging Service and campaign.
