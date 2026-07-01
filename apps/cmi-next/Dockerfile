# syntax=docker/dockerfile:1

# =============================================================================
# CMI dashboard (Next.js standalone) — BUILD vs RUNTIME environment contract
#
#   BUILD-TIME (ARG): baked into image layers/metadata and, for NEXT_PUBLIC_*,
#   inlined into the client bundle. ONLY non-secret, public values belong here.
#   For this app that is exactly ONE variable: NEXT_PUBLIC_APP_URL.
#
#   RUNTIME (everything else): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#   SUPABASE_ANON_KEY, SESSION_SECRET, STAFF_USERS_JSON, TWILIO_*, SMTP_*,
#   IMAP_*, RESEND_*, HERMES_*/OPENAI_*, RECAPTCHA_*, WP_* … are read from
#   process.env at RUN time and are injected by Coolify as RUNTIME env vars.
#
#   ⚠️  NEVER add a secret as ARG/ENV in this file, and NEVER mark a secret as a
#   "Build Variable" in Coolify. Doing either bakes the secret into the image
#   (visible via `docker history` / build metadata). Secrets are runtime-only.
# =============================================================================

# Stage 1: install deps + build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# The ONLY build arg: a public, non-secret URL that Next inlines into the client
# bundle. Do not add anything else here.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# Stage 2: production runtime — secrets arrive here at run time from Coolify,
# never at build time.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
