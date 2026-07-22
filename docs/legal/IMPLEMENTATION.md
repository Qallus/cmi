# Legal & Communications Compliance — Implementation Record

**Implemented:** July 22, 2026
**Source content:** `docs/legal/*.md` (unchanged — those files remain the source of truth)

This documents what was built for the six public compliance pages, how consent is
stored, and what still needs a human before A2P 10DLC submission.

---

## 1. Public routes

All six pages are public. **None is behind authentication**, and none may be
placed behind a login — Twilio's A2P review and CAN-SPAM both require this.

| Page | Route | Source document |
|---|---|---|
| Privacy Policy | `/privacy-policy` | `privacy-policy.md` |
| Terms of Service | `/terms-of-service` | `terms-of-service.md` |
| SMS Opt-In | `/sms-opt-in` | `sms-opt-in.md` |
| SMS Opt-Out | `/sms-opt-out` | `sms-opt-out.md` |
| Email Opt-In | `/email-opt-in` | `email-opt-in.md` |
| Email Opt-Out | `/email-opt-out` | `email-opt-out.md` |

### URL migration

The Privacy Policy and Terms moved to match the compliance package:

- `/privacy` → `/privacy-policy` (HTTP 308 permanent)
- `/terms` → `/terms-of-service` (HTTP 308 permanent)

Redirects are declared in `apps/cmi-next/next.config.ts`. The old routes keep
working, so any previously published link, email footer, or PDF stays valid.
The old `app/privacy/` and `app/terms/` page files were deleted.

> **Domain note.** `docs/legal/README.md` lists some URLs on
> `constructedmatter.com` and others on `my.constructedmatter.com`. This app
> serves `my.constructedmatter.com`. All six pages are live there. If the
> apex domain is served by a separate system, the same six paths must either be
> mirrored or redirected there before the URLs are submitted to Twilio.

---

## 2. Files added / changed

### Added
| File | Purpose |
|---|---|
| `app/privacy-policy/page.tsx` | Full Privacy Policy (16 sections, verbatim) |
| `app/terms-of-service/page.tsx` | Full Terms of Service (25 sections, verbatim) |
| `components/legal/legal-page.tsx` | `LegalPageLayout`, `LegalCrossLinks`, `LEGAL_ROUTES`, `CMI_CONTACT` |
| `components/consent/consent-page-layout.tsx` | Chrome for the four consent pages |
| `components/consent/consent-form.tsx` | Shared, config-driven consent form |
| `supabase/2026-07-22_messaging_consent_compliance.sql` | Schema migration (applied) |

### Changed
| File | Change |
|---|---|
| `app/sms-opt-in/page.tsx` | Rebuilt from `sms-opt-in.md` |
| `app/sms-opt-out/page.tsx` | Rebuilt from `sms-opt-out.md` |
| `app/email-opt-in/page.tsx` | Rebuilt from `email-opt-in.md` |
| `app/email-opt-out/page.tsx` | Rebuilt from `email-opt-out.md` |
| `app/api/consent/route.ts` | Accepts categories + full audit payload |
| `lib/messaging/consent.ts` | Categories, audit fields, CRM linkage |
| `components/site/site-footer.tsx` | Updated legal links, added SMS/Email Opt-Out |
| `app/globals.css` | `.cmi-legal` document typography |
| `next.config.ts` | Permanent redirects for the moved routes |

### Removed
- `components/consent/consent-page.tsx` — the old hard-coded dark-green form.
  It ignored the design system (inline styles, fixed `#0f1c14`/`#c8a35b`
  colours, no header/footer), had a single free-text field with no consent
  checkboxes, and captured none of the required audit data.

---

## 3. Database changes

Migration `supabase/2026-07-22_messaging_consent_compliance.sql`.
**Already applied to the production Supabase project.** Additive only — no
column was dropped, renamed, or retyped, and no data was modified.

### `messaging_suppressions` (new columns)
| Column | Type | Meaning |
|---|---|---|
| `marketing_opted_out` | `boolean not null default false` | Marketing suppressed; transactional still allowed |
| `opted_out_at` | `timestamptz` | When the full opt-out happened |
| `marketing_opted_out_at` | `timestamptz` | When the marketing opt-out happened |
| `opt_out_method` | `text` | `public_page`, `sms_keyword`, `staff`, … |

The existing `opted_out` column keeps its meaning: opted out of **everything**
on that channel.

### `messaging_consent_events` (new columns)
`categories text[]`, `disclosure_version`, `disclosure_text`, `source_url`,
`ip`, `user_agent`, `first_name`, `last_name`, `email`, `phone`, `company`,
`relationship`, `contact_id` (FK → `contacts.id`).

Plus indexes on `(channel, address, created_at desc)` and `(contact_id)`.

This satisfies the README's "Recommended Consent Architecture": rather than
scattering `sms_marketing_consent`-style booleans across `contacts`, current
state lives in `messaging_suppressions` and the full evidentiary history lives
in `messaging_consent_events` — one immutable row per action, with the exact
disclosure text the user saw.

### RLS
Both tables already had RLS enabled with **zero policies**, which is correct:
they are written only by server-side routes using the service-role key. The
anon and authenticated keys cannot read or write consent data. The migration
re-asserts this idempotently.

---

## 4. How consent is stored

`applyConsent()` in `lib/messaging/consent.ts` writes both the current state
and the audit row:

| Action | `opted_out` | `marketing_opted_out` |
|---|---|---|
| Opt in — service + marketing | `false` | `false` |
| Opt in — **service only** | `false` | **`true`** |
| Opt in — marketing only | `false` | `false` |
| Opt out — all | `true` | `true` |
| Opt out — **marketing only** | `false` | `true` |

The critical row is the second: **opting in to service messaging never grants
marketing consent.** Marketing is suppressed unless the user ticks the marketing
box, per the README's "do not infer SMS marketing consent from…" rule.

Also captured per event: consent date (`created_at`), source URL, disclosure
version (`CONSENT_DISCLOSURE_VERSION`, currently `2026-07-22`), the verbatim
disclosure text rendered on the page, IP, user agent, and the submitted name /
email / phone / company / relationship.

> Bump `CONSENT_DISCLOSURE_VERSION` in `lib/messaging/consent.ts` whenever the
> consent wording changes, so stored records stay reproducible.

---

## 5. Suppression enforcement

`isSuppressed(channel, address, category = "service")`:

- `category: "service"` (the default) — blocked only by a **full** opt-out.
  All eight existing transactional callers keep their current behaviour.
- `category: "marketing"` — blocked by a full opt-out **or** a marketing-only
  opt-out. Use this for campaigns and scheduled promotional sends.
  `isMarketingSuppressed(channel, address)` is the shorthand.

Already enforcing suppression (unchanged): `/api/communications/send`, invoice
send, agent tool registry, business-card notifications, canvas notifications,
client-portal notifications, project-manager notifications.

### Inbound STOP / START

`app/api/webhooks/twilio/sms/route.ts` already routes carrier keywords into the
same suppression table:

- **STOP** (also STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, OPTOUT, REVOKE) →
  full opt-out on both categories, `opt_out_method: sms_keyword:<KEYWORD>`.
- **START** (also YES, UNSTOP) → opts back in to **service only**. A one-word
  reply never restores marketing consent; that requires the documented opt-in
  flow.

> **Gap to close.** There is no marketing-campaign sender in the app yet —
> broadcasts are in-app + web push only. When one is built (Resend for email,
> Twilio for SMS), it must call `isSuppressed(channel, address, "marketing")`
> or `isMarketingSuppressed()`. Nothing reads `marketing_opted_out` today.

---

## 6. CRM linkage

`linkConsentToContact()` attaches each submission to `contacts`:

1. Match on email (case-insensitive), else
2. Match on phone (compared as normalised digits), else
3. Create a contact — **only when an email was supplied**, because
   `contacts.email` is `NOT NULL`.

An SMS-only opt-in with no email is still fully recorded in
`messaging_consent_events`; it just has no `contact_id`. Existing contact fields
are never overwritten with blanks — only empty `phone`/`company` are filled in.

`contacts.type` has a CHECK constraint, so the form's richer relationship list
is mapped onto the permitted vocabulary (`Prospective Client` → `Prospect`,
`Subcontractor` → `Sub Contractor`, `Supplier` → `Vendor`, and so on). The
verbatim answer is preserved on the consent event regardless. New contacts get
`status: "active"`, `source: "consent_page"`.

CRM linkage is best-effort and wrapped in a try/catch: **an opt-out must never
fail because of a CRM problem.**

---

## 7. Remaining setup — needs a human

These are outside what code can decide.

1. **Confirm the Twilio messaging number.** `docs/legal/README.md` line 70 still
   reads `[CONFIRM BEFORE PUBLISHING OR A2P SUBMISSION]`. It is not referenced
   by any page yet.
2. **Legal review.** Per `README.md`, counsel should review the governing-law,
   liability, call-recording, and AI-voice sections before publication.
3. **Mirror or redirect the apex domain** if `constructedmatter.com` is a
   separate site (see §1).
4. **Marketing campaign sender must honour `marketing_opted_out`.** There is no
   marketing campaign sender in the app yet. Whenever one is built, it must
   check `isMarketingSuppressed(channel, address)` — a plain `isSuppressed()`
   call defaults to the transactional rule and will happily send marketing to
   someone who opted out of marketing only. This is the main open CAN-SPAM item.
5. **HELP keyword auto-reply.** STOP/START are handled; confirm Twilio's
   default HELP response names "Constructed Matter" and points at support.
6. **Email-topic segmentation.** The Email Opt-Out page offers the four choices
   from the source document (all / newsletters / events / offers), but CMI has
   no topic segmentation, so **any** selection is applied as a full
   marketing-email opt-out. That over-suppresses in the recipient's favour,
   which is safe — but if topic-level granularity is wanted, add the topics to
   the sending system and split them into distinct categories.
7. **Add consent checkboxes to the other public forms.** The contact and booking
   forms do not yet capture SMS consent. The README requires SMS consent to be
   separate, optional, and unchecked wherever it is offered.
8. **Add the postal address + unsubscribe link to marketing email templates**
   (CAN-SPAM). The address is in `CMI_CONTACT` in
   `components/legal/legal-page.tsx`.

### Environment variables
**No new environment variables.** The pages use the existing Supabase
service-role connection via `getSupabaseAdmin()`.

---

## 8. Verification performed

- `npx tsc --noEmit` and `npx eslint` — clean.
- `next build` — all six routes prerender as static.
- Route check: `/privacy` and `/terms` return 308 to the new URLs; all six
  compliance pages return 200.
- Content fidelity: automated 12-word shingle comparison of each rendered page
  against its source Markdown — 98.2% (Privacy) and 95.1% (Terms). Every
  non-match was traced to an intentional layout move (effective date and the
  Terms intro paragraph relocated into the page hero) or list-marker
  normalisation. Heading counts match the sources exactly (16 and 25).
- End-to-end against the real database: service-only opt-in correctly left
  `marketing_opted_out = true`; marketing-only opt-out left `opted_out = false`;
  full opt-out set both; contact created and correctly type-mapped; audit
  columns populated. Validation rejects an empty category set and a malformed
  address. All test rows were deleted afterwards.
- Accessibility spot-check on `/sms-opt-in`: every input has an associated
  `<label>`, both consent checkboxes are unchecked on load, required fields are
  marked, errors use `role="alert"`, the confirmation uses `role="status"` and
  receives focus.
