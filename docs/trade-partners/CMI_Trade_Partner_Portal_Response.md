# Trade Partner Portal: Response to the Requirements Brief

- **To:** Brandon Fadden, President
- **From:** Jeremy Waters
- **Re:** *Trade Partner Portal & Vendor Management, Requirements brief (Oct 26, 2026)*
- **Date:** October 28, 2026

Thanks for the brief. It's clear and buildable. Below is where we stand today, my answers to the open questions in
Section 13, and how I'd phase the work. The build plan is in `CMI_Trade_Partner_Portal_Build_Plan.md` in this folder.

---

## 1. Where we stand today

About a third of the brief is already live at constructedmatter.com/prequalification and in Dashboard → Trade Partners.

| Area | Status today |
| --- | --- |
| Online application with save-and-continue and document uploads | ✅ Live |
| Applications review queue: Approve / Decline, verify or reject each document, gaps list | ✅ Live (needs your four-button flow) |
| Directory and Compliance worklist | ✅ Live (needs cleanup, see 3.4) |
| Expiration reminders | ⚠️ Built, but on a 30 / 7 / 0-day schedule and currently switched off. Needs your 45-day / weekly / 7-day schedule. |
| Contact page path selector, spam filtering, vendor vs. lead sorting | ❌ Not built. Today every contact form becomes a "Lead". |
| Confirmation email to the applicant | ❌ Not built |
| MSA display and signature | ❌ Not built. Today it's a typed name only. |
| AI reading of COIs / W-9s | ❌ Not built |
| Filing to the V drive | ❌ Not built |
| Follow-up and missing-document email drafts | ❌ Not built |
| Requalification | ❌ Not built |
| Trade → cost code mapping and Excel export | ❌ Not built |
| PO compliance check | ❌ Not built (no purchase orders in the system yet) |

---

## 2. Answers to your open questions (Section 13)

### Q1. Can the MSA be signed inside the application instead of DocuSign?

**Yes.** Arizona's Uniform Electronic Transactions Act and the federal ESIGN Act treat an electronic signature as legally
binding when we can show four things. Here is how the portal will cover each one:

| Requirement | How the portal covers it |
| --- | --- |
| **Consent** to do business electronically | A short "I agree to sign electronically" checkbox with the standard disclosure |
| **Intent** to sign | The sub reads or downloads the current MSA, then types their name and title and draws their signature |
| **Attribution** (it was really them) | A one-time code emailed to the signer, plus a timestamp, IP address and device. A fingerprint (hash) of the exact MSA version they signed is also recorded. |
| **Record retention** | A signed PDF of the MSA with a signature certificate page, filed to the V drive (`MSAs/[Company]_MSA_Rev2026_signed[date].pdf`) and emailed to the sub and info@ |

- **Countersignature:** you or another authorized signer countersigns from the dashboard, so the agreement is fully
  executed.
- **Latest version:** the portal always serves the current MSA. When the 2026 rewrite is final, we upload it once and
  every new application and requalification uses it.
- **Recommendation:** have our attorney approve the one-paragraph e-signature consent wording before launch.

### Q2. Best way to auto-sync uploads into the V drive?

The V drive is our Google Shared Drive, so the portal will **write each document straight into it** through a secure
Google connection. No downloading and re-uploading.

- **Naming:** each file is named *after* the AI reads it, so the name carries the real coverage and expiration date. The
  conventions in your brief work. For example, a COI becomes `[Company]_COI_GL_exp2027-03-15.pdf` and lands in
  `Insurance/COIs/Mar 2026–Mar 2027/`.
- **Master insurance tracking sheet:** this becomes a live Google Sheet in the Insurance folder. The system updates it
  on every upload. It's always current and still exports to Excel.
- **Documents a sub emails to Yovana:** she uploads them on the sub's record in the dashboard, and they go through the
  same naming, filing, AI reading and tracking. We can also add a "drop" folder in the V drive that the system picks up
  automatically.
- **What's needed:** the Google Workspace connection we're setting up now. It's waiting on our Google Cloud admin to
  allow the service-account key, plus two extra Google permissions: writing to Drive and updating the tracking Sheet.

### Q3. Can the portal sync vendor records and documents into Adaptive?

Based on Adaptive's published API, **not fully.** Vendors, bills and expenses can be **read** through the API but not
created or updated, and there's no way to upload documents. My recommendation:

- **The portal is the source of truth** for trade partner records, documents and compliance status.
- **Adaptive stays payments**, plus two useful read-backs:
  - **Linking:** each trade partner is linked to its Adaptive vendor. This also helps find duplicates.
  - **PO check:** every night the system reads Adaptive's POs and bills and flags any PO to a sub who isn't approved or
    whose insurance is expired or missing.
- **Backstop:** Adaptive's payment hold stays as is.

**Questions for the Adaptive rep** (please add them to the refresher call):

1. Is there an API to **create or update vendors**, or to **upload vendor documents**? Anything on the roadmap?
2. Is there a **document status / compliance field** on vendors we could read or set?
3. Can document requests go out **in bulk**? Do we get notified (email or webhook) when a sub uploads?
4. Can the vendor export include **document status**? Can subs be separated from other payee types (a vendor type or
   tag)?
5. **API access:** how do we get an API key or OAuth client, the base URL and our realm ID? Can it be read-only?

### Q4. Which AI parses the COIs? Can it use Claude?

Nothing parses them yet. **We'll use Claude**, which reads PDFs and scanned certificates well. For each certificate it
extracts:
- every coverage line: GL, auto, umbrella, workers' comp
- limits, carrier, policy number, and effective and expiration dates

It then checks them against our MSA minimums and flags anything short or missing. Cost is pennies per certificate.
Yovana can stop running COIs through Claude by hand.

### Q5. Email sender and drafts

- **Automatic notices** (confirmations, reminders, onboarding guide) send from **info@constructedmatter.com**.
- **Follow-up and missing-document emails are drafts, never auto-sent.** They open pre-written in the dashboard. The
  reviewer edits, then clicks Send. They go out from info@, and **replies go to the reviewer's own inbox**.
- **Gmail Drafts (optional):** we can drop the draft into the reviewer's Gmail Drafts folder instead. That needs one more
  Google permission.

### Q6. Did I pre-fill the vendor directory? OK to purge?

**Yes, the CMI directory.** In September I created a company record for every company name in our Contacts (340 of
them), so contacts could link to real companies. That's why the Trade Partner directory is cluttered:

- **340 of 349** entries have no partner type. **330** of those came from *client leads*, not subs.
- Only **9** came from real applications.
- There are about **32 likely duplicate pairs** and **62 abandoned draft applications**.

**I didn't pre-fill Adaptive's directory.** If it has duplicates and non-trade vendors, they likely came in through the
QuickBooks sync.

**Plan:** the Trade Partner directory will show only real partners (applicants, approved, or anyone marked
Subcontractor/Supplier/Vendor). The backfilled client companies are hidden from it (not deleted, because contacts still
point to them). A **"merge duplicates"** tool cleans up the rest. Yovana can review the list before anything is merged.

### Q7. "Under Review" status and 90-day auto-archive

Both fit the existing setup. Incomplete applications with no activity for 90 days move to Archive automatically, and
can be reactivated anytime.

### Q8. Phasing

Your phasing is right. I'd make three small changes:

1. **Move the MSA signature into Phase 1.** It's part of submitting the application.
2. **Move the Excel export into Phase 2.** It's quick, and Yovana needs it for the audit.
3. **Pull the PO check forward** if your PO generation is ready before Phase 4. The check itself is small once
   compliance status is tracked (end of Phase 3).

| Phase | What ships | Rough time |
| --- | --- | --- |
| **1. Front door** | Contact page paths and "Interested in working with us"; spam filtering; vendor vs. lead sorting; "Become a Trade Partner" page; all form changes in Section 5; trades mapped to cost codes; **MSA view and e-signature**; confirmation email from info@; directory cleanup and duplicate merge | ~1.5–2 weeks |
| **2. Review and filing** | Four review buttons with drafts; onboarding guide email on approval; "Under Review" status and 90-day auto-archive; manual upload for a sub; Excel export (cost codes, 1099 structure, contacts by role, document status); **V drive filing** with naming and folders (once Google is connected) | ~1.5 weeks |
| **3. AI and reminders** | Claude reads every COI and W-9; master insurance tracking Sheet; 45-day, weekly and 7-day reminders with CC Yovana at 7 days and stop after expiry; red flags; **Requalification** with select-all, exclude and mass message | ~2 weeks |
| **4. POs and Adaptive** | PO compliance flag (on our PO generation and/or nightly Adaptive PO check); link trade partners ↔ Adaptive vendors; anything the Adaptive rep confirms we can sync | ~1 week after the Adaptive call |

---

## 3. What I need from you and the team

| Item | From | Needed for |
| --- | --- | --- |
| Final **2026 MSA** (PDF) and who countersigns | Brandon | Phase 1 (we can launch with the current MSA and swap later) |
| **Insurance minimums** per coverage line (GL per-occurrence and aggregate, auto, umbrella, WC) | Brandon / MSA | Phase 1 yes/no questions; Phase 3 AI check |
| **Expanded trade list with cost codes** (or our cost code list and I'll map it for review) | Yovana / Brandon | Phase 1 |
| **Trade Partner Onboarding Guide** (1–2 pages) | Brandon | Phase 1 overview page; Phase 2 approval email |
| Approval of the **e-signature consent wording** | Attorney | Phase 1 launch |
| **Google Cloud admin:** allow the service-account key and add the Drive and Sheets permissions | Google admin | Phase 2 V drive filing |
| **V drive folder paths** for Insurance / W-9s / Licenses / MSAs | Yovana | Phase 2 |
| Answers from the **Adaptive call** (questions in Q3) | Yovana / Jeremy | Phase 4 |
| Review of the **duplicate merge list** before it runs | Yovana | Phase 1 cleanup |

---

**Related, from Section 14:** the office desk phones on our Twilio number (business-hours ring, after-hours forward,
voicemail and an emergency phone tree) are doable with our existing Twilio setup. I'll scope that separately so it
doesn't slow the portal.
