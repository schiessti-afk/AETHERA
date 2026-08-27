FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY services/ingestion/package.json ./services/ingestion/package.json

RUN pnpm install --filter @aethera/api...

COPY apps/api ./apps/api
COPY tsconfig.base.json ./
COPY docker/point-packages-at-dist.cjs ./docker/point-packages-at-dist.cjs

RUN pnpm --filter @aethera/api... build \
 && node docker/point-packages-at-dist.cjs \
      packages/types \
      packages/validation \
      packages/flight-engine

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/ready').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
