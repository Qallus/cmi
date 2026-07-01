import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
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
};

export default nextConfig;
