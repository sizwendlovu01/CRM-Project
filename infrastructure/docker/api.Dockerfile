# syntax=docker/dockerfile:1
# NestJS API image. Build context: repository root.

FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat && corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @crm/api... --filter @crm/shared
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @crm/shared build \
 && pnpm --filter @crm/api exec prisma generate \
 && pnpm --filter @crm/api exec nest build \
 && pnpm deploy --legacy --filter @crm/api --prod /prod/api \
 && cd /prod/api && npx prisma generate

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini && addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=app:app /prod/api/node_modules ./node_modules
COPY --from=builder --chown=app:app /repo/apps/api/dist ./dist
COPY --from=builder --chown=app:app /repo/apps/api/prisma ./prisma
COPY --from=builder --chown=app:app /repo/apps/api/package.json ./package.json
USER app
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD wget -qO- http://127.0.0.1:4000/health/live || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# Apply pending migrations, then start the API.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
