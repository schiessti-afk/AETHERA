FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages ./packages
COPY services/ingestion/package.json ./services/ingestion/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --filter @aethera/ingestion...

COPY services/ingestion ./services/ingestion
COPY tsconfig.base.json ./
COPY docker/point-packages-at-dist.cjs ./docker/point-packages-at-dist.cjs

RUN pnpm --filter @aethera/ingestion... build \
 && node docker/point-packages-at-dist.cjs \
      packages/types \
      packages/validation \
      packages/flight-engine \
      packages/anomaly-engine

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/services/ingestion
CMD ["node", "dist/index.js"]
