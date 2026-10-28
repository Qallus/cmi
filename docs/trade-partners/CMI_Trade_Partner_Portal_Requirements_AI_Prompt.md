# Trade Partner Portal & Vendor Management
_Requirements brief for website / system build_

- **Prepared for:** Jeremy
- **Prepared by:** Brandon Fadden, President — Constructed Matter, Inc.
- **Source:** Internal working session with Yovana, Oct 26, 2026 (Plaud recording)
- **Date:** October 26, 2026
- **Status:** Requirements — ready to build; open items flagged in Section 13

> Instructions for AI: treat this as the requirements spec for the Constructed Matter website trade partner portal and vendor management back end. Build to these requirements; items marked "confirm" or listed in Section 13 need a decision before final build.

## 1. What we're trying to accomplish

We want to move trade partner (subcontractor/vendor) onboarding, document collection, and compliance tracking onto the Constructed Matter website so the subs carry the load of submitting and keeping their own information current — not our office. Today it's manual, duplicated, and easy to miss.

- One link we can hand any sub ("the sub we meet on the street") to apply and pre-qualify.
- Documents uploaded once by the sub, automatically filed in the V drive with the right name and folder — no re-downloading or double entry.
- AI reads every COI/W-9 for expiration dates and coverage, then handles reminders automatically.
- Clear review queue with approve / decline / follow-up actions and auto-drafted emails.
- Annual requalification that's a button press, not a project.
- Purchase orders flagged when the sub isn't approved or their documents are missing or expired.
- Everything exportable to Excel (with cost codes) for audits and 1099s.

## 2. Current state & pain points

- Adaptive vendor management is weak. Document requests have to be clicked one vendor at a time, and we can't tell whether Adaptive notifies us when a sub uploads.
- Adaptive lumps every payee together (subs, food, misc. receipt-type vendors), so the sub list is cluttered. Buildertrend handled subs and bid packages better, but couldn't track our misc. costs — we're moving fully to Adaptive for new jobs.
- Yovana is currently saving documents in our folders AND in Adaptive (and previously Buildertrend too) — duplicated work.
- Yovana uses Claude to scan the archive and list expiring COIs, and to draft reminder emails, but entering each one is still one-by-one.
- Adaptive's sub list export doesn't include document status. The directory has duplicates (e.g., the photographer listed twice) and unrelated vendors — Jeremy may have pre-filled it.
- Website contact form can't tell a vendor application from a client lead or spam; vendor inquiries land as leads.

> **Non-negotiable: the V drive stays the system of record for W-9s and COIs. We get audited every year and must be able to pull every certificate fast. Whatever we build must land documents there automatically.**

## 3. End-to-end flow

1. Prospect hits "Let's Start a Conversation" (or we send them the link) → selects "Trade partner looking to work with Constructed Matter."
2. Sub completes the Pre-Qualification Application, uploads documents, reviews the current MSA and signs/acknowledges it digitally.
3. Auto-confirmation email goes out from info@constructedmatter.com. Uploads auto-file to the V drive; AI parses expirations and coverage.
4. Application appears in our Applications review queue. Office reviews and picks one of four actions: Approve, Decline, Schedule Follow-Up Meeting, or Follow Up for Missing Documents.
5. On Approve → sub moves into the Trade Partner Directory and the Trade Partner Onboarding Guide is emailed automatically.
6. Ongoing: document status tracked; expiration reminders run automatically; red flags show on the directory and on any PO issued to that sub.
7. Annually (start of the year) or as needed: office selects subs and sends the Requalification form.

## 4. Website — "Let's Start a Conversation" page

- Keep the address, phone number, and email as they are.
- Add an initial drop-down / path selector BEFORE the form fields, so each visitor goes down their own path:
  - Trade partner looking to work with Constructed Matter → routes to the Trade Partner / Pre-Qualification path.
  - Client looking to build a new home (or remodel) → client lead path.
  - Have a product or service to present to Constructed Matter → product/service provider path.
- Add a clear button for "Interested in working with us" that goes straight to the vendor path.
- Add spam filtering. Right now it's hard to tell a true lead from spam from a vendor pitch.
- Back end / AI must classify vendor applications as vendors (send to vendor management), NOT as leads.
- Add a "Become a Trade Partner" area where subs can read the 1–2 page onboarding / pre-qualification overview before applying.

## 5. Pre-Qualification Application — field-by-field changes

General rule: use drop-downs, yes/no, and ranges wherever possible (easier for subs, cleaner data for reporting). Every field must be reportable / exportable to Excel on the back end.

### 5.1 Company information

| Field | Required | Notes |
|---|---|---|
| Company name | Yes |   |
| Legal name (if different) | No |   |
| Type of partner | Yes | Drop-down: Subcontractor, Supplier/Vendor, Consultant, etc. |
| Business structure | Yes | Drop-down (Sole prop, LLC, S-Corp, C-Corp, Partnership). Drives whether we issue a 1099 — must be on the export. |
| Years in business | Yes | Drop-down range |
| Website / social media | No |   |
| Business address | Yes |   |
| Office phone | Yes |   |
| Company email | Yes |   |

### 5.2 Contacts

Break contacts into separate boxes. Each secondary contact gets a "Same as primary contact" checkbox that auto-fills it.

- Primary contact (required)
- Accounting contact
- Estimating / bid contact (rename from "Estimator")
- Field contact
- After-hours emergency contact

These contacts will feed bid packages later, so they need to be pullable by role.

### 5.3 Trades & specialties

- Expand the list — a lot of trades are missing.
- Every trade must map to a Constructed Matter cost code on the back end. Cost codes do NOT need to show to the sub, but must appear on reports and Excel exports.
- If they pick "Other," open a free-text field to describe it.
- Fix spelling of "Specialized" in this section header/labels.

### 5.4 Where you work

- Keep as is.
- Fix spelling of "Mobilization."

### 5.5 Your team / capacity

- Convert to drop-down or yes/no. A "Yes" (e.g., currently available) prompts a date and a short explanation of capacity / projects they'll take.
- Use drop-down ranges for crew size / capacity instead of open text.
- Remove "Can you support an accelerated schedule?" — schedule is project-by-project, not fair to ask up front.

### 5.6 Estimating & pricing

- Remove "How do you price your work?"
- Add: Can you estimate from plans? (Y/N)
- Add: Can you estimate without plans? (Y/N)
- Add: Do you need a site walk before bidding? (Y/N)
- "Payment terms you typically work on" — optional, OK to keep.

### 5.7 Equipment & certifications → Licensing & insurance

- Remove equipment questions entirely — we don't need to know what equipment they carry.
- Move bonding capacity into a Licensing & Insurance section.
- Ask insurance as yes/no against OUR minimums: "Do you carry at least [CMI minimum per the MSA]?" for each coverage line.
- State clearly that before working with Constructed Matter they must provide a W-9 and current COI(s).
- Uploads: W-9, COI(s) (GL, auto, workers' comp — often all on one certificate), contractor license (ROC).
- Note: some subs pay each time they pull a COI and won't do it without work lined up. Allow the application to be submitted without a COI, but the sub gets a red flag once approved until it's in.

### 5.8 Experience, references & portfolio

- Pull the Experience & References section out for now.
- Portfolio: let them either paste a link OR upload specific project photos/files (optional).

### 5.9 Confirm & submit — MSA

- Show the most current Master Subcontractor Agreement (MSA) for them to read/download (must always pull the latest version — currently the 2026 rewrite in progress).
- Real digital signature (not just a checkbox) to acknowledge/sign the MSA as part of the application, ideally replacing a separate DocuSign send. Jeremy to confirm feasibility (Section 13).
- On submit: automatic confirmation email from info@constructedmatter.com.

## 6. Applications review queue (back end)

Click into any application and see everything they submitted plus a checklist of required documents (submitted / missing / expired). Four action buttons:

| Action | What it does |
|---|---|
| Approve as Trade Partner | Moves the sub into the Trade Partner Directory. Automatically emails the Trade Partner Onboarding Guide. From here, W-9 and COI are mandatory — red flag if missing. |
| Decline | Requires a reason. Moves the application to an Archive section (not deleted) — we can reactivate later. |
| Schedule Follow-Up Meeting | Auto-drafts a reply from the reviewer's email: "Thank you for submitting — we'd love to meet…" with a spot to plug in a time at our office. Draft for review, not auto-sent. |
| Follow Up (missing documents) | Auto-drafts a request listing what's missing (e.g., "Please submit your W-9"). Free-text field to add notes. |

Yovana's suggestion (confirm): an "Under Review / Waiting" status, and auto-archive incomplete applications after 90 days of inactivity.

## 7. Document handling & AI parsing

### 7.1 Auto-filing to the V drive

- Every upload syncs automatically to the mapped V drive folder — W-9s together, COIs together. No manual downloading.
- Auto-rename every file to a standard naming convention so it can be found and auto-mapped (proposed below — confirm).
- Group COIs by insurance year. Our insurance period typically runs March to March, so align folders to that expiration year for easy audit pulls.
- Office must always be able to manually upload a document for a sub (e.g., a sub emails it to Yovana) and have it go through the same naming, filing, parsing, and tracking process.

| Doc | Proposed naming / folder (confirm) |
|---|---|
| COI | V:\\…\\Insurance\\COIs\\[Mar YYYY–Mar YYYY]\\[Company]_COI_[Coverage]_exp[YYYY-MM-DD].pdf |
| W-9 | V:\\…\\W-9s\\[YYYY]\\[Company]_W9_[YYYY].pdf |
| License | V:\\…\\Licenses\\[Company]_ROC[number]_exp[YYYY-MM-DD].pdf |
| MSA | V:\\…\\MSAs\\[Company]_MSA_Rev[YYYY]_signed[YYYY-MM-DD].pdf |

### 7.2 AI review of certificates

- Read each COI and extract expiration dates for every coverage line (GL, auto, umbrella, workers' comp — often on one certificate).
- Confirm coverage against our minimums and give a breakout per coverage line (limits, carrier, policy #, effective/expiration).
- Flag anything below minimum or missing (e.g., no workers' comp).
- Populate the tracking fields automatically — no one-by-one data entry.

### 7.3 Master insurance tracking sheet

- Maintain a master insurance tracking Excel file in the Insurance folder, updated every time a certificate is uploaded.
- Every sub with a purchase order must be on it.
- Exportable to Excel for audits and tracking.

## 8. Expiration reminders & escalation

All automated notices send from info@constructedmatter.com and include the requalification/upload link with the expiring documents highlighted.

| Timing | Action | CC |
|---|---|---|
| 45 days before expiration | First automatic notice to the sub | No CC |
| Weekly after that | Weekly reminder until updated | No CC |
| 7 days before expiration | Language escalates (more urgent) | CC Yovana |
| After expiration | Auto-notices stop. Yovana drafts follow-up herself and chooses who in the company to CC | Yovana's choice |
| Any time missing/expired | Red flag on directory record and on any PO to this sub | Internal notification |

## 9. Requalification

- Separate "Requalification" button / form in the subcontractor portal — simpler than the initial application.
- Pre-filled with what they already submitted: "Let us know if anything has changed." Expired documents highlighted with what's needed.
- Annual cycle at the start of each year (that's when we collect updated W-9s and fresh COIs).
- Office (Yovana or anyone) can Select All or pick specific subs to send to, and exclude subs we no longer use so we're not bugging them.
- Same send can carry a mass message, a policy change, or the updated MSA for signature.
- Also triggered automatically by the 45-day expiration notices (Section 8).

## 10. Purchase order compliance check

- Brandon is building purchase order generation on the back end now; when a PO is issued it should check the sub's status.
- Flag any PO written to a sub that is not an approved trade partner, has no W-9/COI on file, or has expired insurance.
- Goal: push responsibility back on the subs to keep their info current through the portal.
- Adaptive already lets us put a payment hold when documents are out — keep that as the backstop.

## 11. Directory, reporting & exports

- Trade Partner Directory separate from general vendors (food, receipts, misc.).
- Clean up the existing directory: remove unrelated vendors and duplicates.
- Export the full vendor/trade partner list to Excel including cost codes, business structure (1099), all contacts by role, document status and expiration dates.
- Contacts by trade/cost code feed bid packages when we send out for bids.

## 12. Adaptive — how it should fit

We still run finances and payments through Adaptive, and it shows when a vendor's documents are expired. We're scheduling a refresher call with our Adaptive rep. Ideal answer: the website portal is the front door and source of truth for docs, and syncs to Adaptive so we never enter things twice.

- Can documents/status sync from the portal into Adaptive vendor records (API or import)?
- Can document requests go out in bulk instead of per vendor?
- Does Adaptive notify us when a sub uploads a requested document?
- Can we export the sub list with document status? (Current export doesn't include it.)
- Can subs be separated from other vendor types?

## 13. Open questions for Jeremy

1. Can the MSA be signed within the application (built-in e-signature) instead of a separate DocuSign? What does it take to make that legally solid (signer name, timestamp, IP, PDF of signed version filed to V drive)?
2. Best way to sync portal uploads to the V drive (Google Shared Drive) with auto-naming and folder mapping?
3. Can the portal sync vendor records/documents into Adaptive, or do we keep Adaptive as payments-only?
4. Which AI does the site use to parse COIs? Can it use Claude?
5. Confirm email sender (info@constructedmatter.com) and that "follow-up" drafts land as drafts for review, not auto-sends.
6. Did you pre-fill the current vendor directory? OK to purge non-trade vendors and duplicates?
7. Confirm the 90-day auto-archive and "Under Review" status.
8. Proposed phasing — suggested: (1) contact page routing + application form fixes; (2) review queue + auto-emails + V drive sync; (3) AI COI parsing, reminders, requalification; (4) PO compliance check + Adaptive sync.

## 14. Related items (FYI)

- Trade Partner Onboarding Guide (1–2 page sheet) and 2026 MSA rewrite are in progress — the portal should link to the current versions.
- Office phone: want 1–2 desktop phones on our Twilio number so the main line rings at the office during business hours and forwards to whoever's on after hours, with voicemail and an emergency phone tree. Goal: get the main number off Brandon's cell.
- Internal: Yovana is cleaning up the V drive (archive old templates, standardize naming), running all current COIs through Claude for a coverage/expiration summary, and setting up the Adaptive refresher call.

