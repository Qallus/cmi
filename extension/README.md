# CMI Selection Card Builder — Chrome Extension

Phase 1 scaffold: an MV3 side panel that signs in via the CMI web app, lets staff
type a product's details, pick a destination (Selection Library or a Job), and
save a branded Selection Card into the CMI dashboard. No element picker or
auto-build yet (Phase 2).

## Stack
Vite + `@crxjs/vite-plugin` + React 19 + TypeScript + Tailwind (MV3).

## Develop
```bash
cd extension
npm install
npm run dev      # Vite dev server with HMR
```
Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/dist` (after a build) or the dev output per @crxjs. Click the toolbar icon to open the side panel.

## Build
```bash
npm run build    # outputs dist/ (the unpacked/CWS-uploadable extension)
npm run typecheck
```

## Auth
The panel's **Sign in** opens `https://app.constructedmatter.com/extension-auth`.
That page reads the logged-in CMI session and posts the Supabase token to the
extension (`externally_connectable`); the service worker stores it in
`chrome.storage.session`. On token expiry, sign in again (refresh via the SW is a
Phase 2 item).

## Configuration
- `src/panel/config.ts` → `API_BASE` (the CMI app origin).
- `src/manifest.ts` → `externally_connectable.matches` (must match `API_BASE`).

## Signing key (pin the extension ID)
Add the Chrome Web Store public key as `key` in `src/manifest.ts` so the local
unpacked ID equals the published ID. Set the matching `CMI_EXTENSION_ID` env var
in the CMI app (Coolify) so CORS + the auth handoff target the right ID.
**Never commit the private `.pem`.**

## Server endpoints used
`/api/extension/{session,jobs,selections,cards,images}` — Bearer token, CORS to
the `chrome-extension://` origin, per-user access enforced by
`requireExtensionAccess()`.
