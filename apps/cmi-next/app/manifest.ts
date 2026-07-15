import type { MetadataRoute } from "next";

// Web App Manifest — makes the CMI web app installable on desktop, Android, and
// iOS (Add to Home Screen). Served at /manifest.webmanifest by Next.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Constructed Matter",
    short_name: "CMI",
    description: "Constructed Matter — projects, bookings, and client portal.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#111113",
    theme_color: "#111113",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
