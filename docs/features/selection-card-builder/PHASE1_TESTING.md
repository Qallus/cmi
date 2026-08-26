# Selection Card Builder — Phase 1 Testing Checklist

Phase 1 proves the full pipe end-to-end: a manually-typed card captured in the
extension lands in the CMI dashboard, governed by per-user access control.

## 0. Environment setup

- [ ] **Extension env vars in Coolify** (CMI app):
  - `CMI_EXTENSION_ID` = the extension's ID (once the signing key is set; until
    then the API reflects any `chrome-extension://` origin for dev).
  - `NEXT_PUBLIC_CMI_EXTENSION_ID` = same ID (used by `/extension-auth` to target
    `chrome.runtime.sendMessage`).
- [ ] **Signing key**: paste the CWS public key into `extension/src/manifest.ts`
      (`key`) so the unpacked ID matches the published ID. Rebuild.
- [ ] `NEXT_PUBLIC_APP_URL` = `https://app.constructedmatter.com` (used in the
      card success deep link).

## 1. Migration applied

- [x] Migration `selection_card_builder_phase1` applied via Supabase MCP.
- [ ] Verify columns exist: `project_selections.{eyebrow, long_description,
      features, visible_to_contractor, visible_to_vendor, capture_meta,
      selection_group_id}`.
- [ ] Verify tables exist: `selection_groups`, `extension_access` (RLS enabled,
      no policies).

## 2. Build & load

- [ ] `cd extension && npm install && npm run build` → `dist/` produced.
- [ ] `chrome://extensions` → Developer mode → Load unpacked → `extension/dist`.
- [ ] Toolbar icon opens the **side panel**.

## 3. Auth handoff

- [ ] Panel shows **Sign in** when no token is stored.
- [ ] Click **Sign in** → `/extension-auth` opens.
  - [ ] When already logged into CMI → page shows **Connected**, and the panel
        flips to the capture form (token received by the service worker).
  - [ ] When logged out → page shows **Sign in to continue** → after login, the
        handoff completes.
- [ ] Panel header shows the signed-in staff member's name.

## 4. Access toggle blocks / allows saves

- [ ] Settings → **Extension Access** lists active staff, all **Disabled** by
      default (grant-per-row).
- [ ] With the test user **Disabled**: the panel shows *"Extension access is
      off"* and `/api/extension/session` returns **403 EXTENSION_ACCESS_DISABLED**.
- [ ] Toggle the user **Enabled** → panel **Re-check** → capture form appears.
- [ ] Toggle **Disabled** again mid-session → next save/API call is rejected
      (instant kill switch).

## 5. Card saves from the extension

- [ ] Fill Title (required) + a few fields; live **Preview** updates; **Expand
      preview** opens the modal; light/dark both render correctly.
- [ ] Destination = **Selection Library**, no group → **Save** → success screen
      with **Open in CMI Dashboard →**.
- [ ] Destination = **Job** (search + select) + optional group → Save works.
- [ ] Create a **new selection group** inline → it appears and is selectable.
- [ ] Provide an **Image URL** → after save, the card's image is re-hosted under
      `cmi-media/selections/…` (not the vendor URL).
- [ ] Saved card appears in **Dashboard → Selections** with vendor, price,
      description, features, and visibility flags intact.

## 6. RLS / access verification

- [ ] Direct `chrome-extension://` requests without a Bearer token → **401**.
- [ ] A valid staff token **without** an `extension_access` row → **403**.
- [ ] Client/non-staff token → **403 NOT_STAFF**.
- [ ] Admin-only: a non-admin hitting `/api/admin/extension-access` → **403**.

## Known Phase 1 limitations (by design)

- Manual typing only — no element picker / Auto-Build (Phase 2).
- Token refresh is not automatic; on expiry, sign in again (Phase 2).
- Card preview is a first-pass brand treatment; UI to be refined.
