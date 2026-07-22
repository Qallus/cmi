import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // SAMEORIGIN (not DENY) so the Super Admin Live Page Editor can preview our
  // own pages in a same-origin iframe. External sites still can't frame us,
  // so clickjacking protection is preserved.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=(self) is required for the Twilio browser softphone (getUserMedia)
  // on the Communications dashboard. camera/geolocation remain disabled.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",

  // The deploy build runs on a memory-constrained VPS (Coolify host also runs
  // Postgres/realtime/redis). Next's separate type-check pass was being
  // OOM-killed after "Compiled successfully" (exit 255, no type-error output).
  // Types are already enforced before deploy via `npm run typecheck`, so we
  // skip the redundant in-build pass to keep the production build within
  // memory. Re-enable if the host gets more RAM.
  // (Next 16 no longer runs ESLint during `next build`, so no eslint key here.)
  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wp-constructedmatter-com-985548.hostingersite.com" },
      { protocol: "https", hostname: "images.squarespace-cdn.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },

  async redirects() {
    return [
      // The legal pages moved to the URLs published in the compliance package
      // and submitted to Twilio. Permanent redirects keep the previously
      // published /privacy and /terms links working.
      { source: "/privacy", destination: "/privacy-policy", permanent: true },
      { source: "/terms", destination: "/terms-of-service", permanent: true },
    ];
  },
};

export default nextConfig;
