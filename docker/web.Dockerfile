# syntax=docker/dockerfile:1.7
#
# Build context is the repo root (see docker-compose.yml's `build.context`),
# because apps/web imports raw-TypeScript @app/* workspace packages that Next
# transpiles itself (see next.config.mjs's transpilePackages) — there's no
# per-package dist/ build step, so the whole workspace has to be present.
# `turbo prune` trims that workspace down to exactly what `web` needs.

FROM node:26-alpine AS base
RUN apk add --no-cache libc6-compat
# Node 26 no longer bundles corepack; install it explicitly before enabling.
# `prepare --activate` (not just `enable`) fetches the pinned pnpm binary into
# this layer at build time — keep the version in sync with the root
# package.json's "packageManager" field. Without this, the `runner` stage
# below (which is `FROM base`, not `FROM builder`) would otherwise try to
# download pnpm from the registry on its first invocation at container
# runtime, which fails in network-restricted production environments.
# COREPACK_HOME must be a world-readable path (not the default ~/.cache under
# /root) since the runner stage below runs as a non-root user that can't
# otherwise read root's home directory.
ENV COREPACK_HOME=/opt/corepack
RUN npm install -g corepack@latest \
	&& corepack enable \
	&& corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.10.7 prune web --docker

# Install-only stage, split out from `builder` so a dev override (see
# docker-compose.override.example.yml) can target it directly and run
# `next dev` against bind-mounted source, without paying for a `next build`
# it doesn't need.
FROM base AS deps
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# turbo prune only copies files it can trace from package.json/lockfile
# graphs; tsconfig.base.json is pulled in via a relative "extends" that it
# doesn't follow, so grab it from the pre-prune checkout explicitly.
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json

FROM deps AS builder
RUN pnpm turbo run build --filter=web...

FROM base AS runner
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app .
USER nextjs
ENV NODE_ENV=production
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
