# A2P 10DLC resubmission — error 30896 (opt-in)

Campaign `CMb905b334f985644f9ffb3a3dd245f23b` · Brand `BN5dd05d901f83b7b5fcea383fa3f15044`

**Edit the rejected campaign — do not delete and recreate it.** The vetting fee is
charged once per campaign; a resubmission of the same campaign is free, a new
campaign is not.

---

## 1. Why it was rejected

The pages were fine. `/sms-opt-in`, `/privacy-policy` and `/terms-of-service` are
publicly reachable, and the required phrases ("Message frequency varies",
"Message and data rates may apply", "Reply STOP", the mobile-number non-sharing
statement) are all in the server-rendered HTML, so a reviewer's crawler sees them
without running JavaScript.

Two things in the **submission** were wrong:

**a. Undeclared opt-in paths.** The submission named one opt-in path,
`/sms-opt-in`. The site had three. The appointment booking form at `/book` and
the event registration form at `/events/{event}` both carried an SMS consent
checkbox, and `/book` actually queued a confirmation text off it. TCR lists this
as a named rejection cause: *"You use more than one opt-in method, but you did
not list every method in the campaign submission."*

Worse for review, those two checkboxes read only "I agree to receive SMS updates
for this appointment." and "Send appointment updates by SMS" — no frequency, no
rate disclosure, no STOP instruction, and no consent record was stored. A
reviewer finding them would have read the submission as incomplete at best.

**b. The message flow paraphrased instead of quoting.** TCR's own passing
example quotes the words on the page. The submitted text described them
("select the separate service/account/project messaging checkbox"), which a
reviewer cannot check against the page.

## 2. What changed in the product

- `/book` and `/events/{event}` now show the full disclosure next to the
  checkbox, identical wording to `/sms-opt-in`, optional and unchecked, with
  links to the Terms and Privacy Policy.
- Both now write a real consent record — number, categories, timestamp, page
  URL, IP, user agent, and the verbatim disclosure text displayed — so the
  consent is provable, not just a preference flag.
- A booking confirmation text is no longer queued to a number that has replied
  STOP. Previously the checkbox alone was enough.
- `HELP` and `INFO` now get a reply from the webhook. Both pages promised HELP;
  nothing in the app answered it, so it depended entirely on Twilio's Advanced
  Opt-Out being switched on.
- New reviewer evidence page at `/sms-consent-disclosure` — every opt-in path,
  the verbatim consent language, screenshots of both forms, what gets recorded,
  and how to opt out. Public, no login, `noindex`.

**These must be deployed before you resubmit.** The reviewer will open
`/sms-consent-disclosure`, and it 404s until the site redeploys.

## 3. Fields to change in the Twilio console

### "How do end-users consent to receive messages?" (message_flow)

Replace the whole field with this:

```text
End users opt in on CMI's public website. There are three opt-in paths, all web forms. There is no keyword opt-in, no purchased or rented list, and no third-party consent.

(1) https://constructedmatter.com/sms-opt-in is the primary path. The visitor enters their name and mobile number and ticks an optional checkbox that is unchecked by default, reading verbatim: "Yes, I agree to receive recurring service, account, and project-related SMS or MMS messages from Constructed Matter, Inc. at the mobile number provided." Immediately beneath it the page states: "Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of purchase." The visitor then presses "Save My SMS Preferences." A separate checkbox on the same page collects marketing consent; ticking marketing alone does not enroll anyone in this campaign.

(2) https://constructedmatter.com/book (appointment booking) and (3) https://constructedmatter.com/events/{event} (event registration) each carry an optional, unchecked checkbox reading: "Yes, I agree to receive SMS or MMS text messages from Constructed Matter, Inc. at the mobile number provided about this appointment." with the same frequency, rate, STOP/HELP and "not a condition of purchase" disclosures directly beneath it.

Every opt-in stores the mobile number, categories, timestamp, page URL, IP address, and the verbatim disclosure text shown. Being a CMI client, subcontractor, vendor, or employee is never by itself consent.

All three flows, with screenshots and the full verbatim language, are documented at https://constructedmatter.com/sms-consent-disclosure

Privacy Policy: https://constructedmatter.com/privacy-policy (states that mobile numbers and SMS consent are not shared with third parties or affiliates for their own marketing, and includes message frequency and message-and-data-rates disclosures). Terms and Conditions: https://constructedmatter.com/terms-of-service
```

### Campaign description

The current description ends with "This campaign does not send marketing or
promotional messages" while the use case is **Low Volume Mixed**, which a
reviewer reads as a contradiction — and the opt-in page visibly offers a
marketing checkbox. Replace the last two sentences with:

```text
Marketing consent is collected separately on the same page and is not used to enroll recipients in this campaign; this campaign carries service, project, and operational messages only. Recipients may reply STOP to unsubscribe or HELP for assistance.
```

Leave the rest of the description as it is.

### Leave these alone

- **Opt-in keywords:** keep empty. Enrollment is by web form, and the message
  flow now says so explicitly.
- **Opt-in message:** keep as is. It is the confirmation sent after a web
  opt-in, and it already carries brand name, frequency, rates, and STOP/HELP.
- **Sample messages:** all five name the brand and carry "Reply STOP to
  unsubscribe." They meet the requirement.
- **Opt-out / help keywords and messages:** Twilio's defaults are correct.

## 4. Before resubmitting

1. Deploy. Confirm `https://constructedmatter.com/sms-consent-disclosure`
   returns the page and both screenshots load.
2. In the Twilio console, turn on **Advanced Opt-Out** for Messaging Service
   `MG4cc2874f0d0f6ac2277bf0bd11b49d87` if it isn't already. The webhook now
   answers HELP as a backstop, but Twilio answering first is cleaner.
3. Paste the two fields above into the campaign and resubmit.

Standard campaigns can take up to several weeks; sole proprietor campaigns are
usually hours to days. Status: Console → Messaging → Regulatory Compliance →
Campaigns.

## 5. Still open (not blocking this resubmission)

- The client portal at `/client/settings` has an SMS toggle that enables texts
  with no disclosure next to it and no consent record. It is behind a login and
  defaults to off, so it is not part of this campaign's flow, but it should get
  the same treatment.
- Sending is enforced against an opt-out list, not an opt-in list: a number with
  no suppression row is treated as sendable. That is the common pattern and is
  legal for transactional messages to people with an existing business
  relationship, but it means the consent records now being written are not yet
  what gates a send.
- A marketing-only opt-out is recorded but never enforced — every send path
  checks the service category. Worth fixing before any marketing SMS goes out.
