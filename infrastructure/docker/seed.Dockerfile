# syntax=docker/dockerfile:1
# One-off development seed runner (includes dev dependencies such as tsx). Never used in production.
FROM node:22-alpine
RUN apk add --no-cache openssl libc6-compat && corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @crm/api... --filter @crm/shared
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @crm/shared build && pnpm --filter @crm/api exec prisma generate
CMD ["pnpm", "--filter", "@crm/api", "db:seed"]
