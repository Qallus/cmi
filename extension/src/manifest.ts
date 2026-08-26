import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json";

// MV3 manifest. activeTab + scripting means the content script is injected on
// demand (Phase 2) — nothing runs on any page until the user opens the panel.
export default defineManifest({
  manifest_version: 3,
  name: "CMI Selection Card Builder",
  version: pkg.version,
  description: "Capture vendor products into branded CMI Selection Cards.",
  minimum_chrome_version: "116",
  permissions: ["sidePanel", "activeTab", "scripting", "storage", "tabs"],
  host_permissions: ["<all_urls>"],
  // Only the CMI app may hand the session token to the extension. Live domain is
  // my.constructedmatter.com; app.* kept for a future cutover.
  externally_connectable: {
    matches: ["https://my.constructedmatter.com/*", "https://app.constructedmatter.com/*"],
  },
  background: { service_worker: "src/sw.ts", type: "module" },
  side_panel: { default_path: "index.html" },
  icons: {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  action: {
    default_title: "CMI Selection Card Builder",
    default_icon: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
  // TODO: paste the Chrome Web Store public key here to pin the extension ID so
  // the local unpacked ID matches the published ID (keeps CORS/CMI_EXTENSION_ID
  // stable). Until then Chrome assigns a random dev ID.
  // key: "<CWS_PUBLIC_KEY>",
});
