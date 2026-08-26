FROM node:20-alpine
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

WORKDIR /app/services/ingestion
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
