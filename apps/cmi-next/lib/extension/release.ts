// The Selection Card Builder build staff download from Dashboard → Chrome Extension.
// To ship an update: bump the version in extension/package.json and
// extension/src/panel/config.ts, `npm run build` in extension/, zip dist/ (without
// *.map) into public/downloads/cmi-selection-card-builder.zip inside a
// "CMI Selection Card Builder" folder, then update the version and date here.
export const EXTENSION_RELEASE = {
  version: "0.1.2",
  updated: "2026-11-09",
  href: "/downloads/cmi-selection-card-builder.zip",
  folder: "CMI Selection Card Builder",
} as const;
