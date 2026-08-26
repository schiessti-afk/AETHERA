FROM node:20-alpine
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

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
