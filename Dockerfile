FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
# Next.js evaluates server modules while collecting build-time route metadata.
# These non-secret placeholders satisfy validation; Compose supplies real values
# only to the runtime container.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV OS4_DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV JWT_SECRET=build-only-placeholder-at-least-32-characters
ENV RESEND_API_KEY=re_build_only_placeholder
ENV RESEND_FROM_EMAIL=build@example.com
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run prisma:generate:os4
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs \
    && corepack enable \
    && corepack prepare pnpm@10.12.1 --activate

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI and ts-node are needed by the startup migration and seed commands.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma-os4 ./prisma-os4
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

CMD ["./scripts/docker-entrypoint.sh"]
