# syntax=docker/dockerfile:1.7
#
# Build context is the repo root — see docker/web.Dockerfile's header comment
# for why (same workspace-pruning reasoning applies to the worker).
# apps/worker has no compiled build step of its own ("build" is `tsc --noEmit`,
# a type-check gate); it runs straight from source via `tsx` at runtime, so
# there's no `turbo run build` stage here, just prune + install.

FROM node:26-alpine AS base
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
RUN pnpm dlx turbo@2.10.7 prune worker --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

FROM base AS runner
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001 -G nodejs
COPY --from=builder --chown=worker:nodejs /app .
USER worker
ENV NODE_ENV=production
WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
