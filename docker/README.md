# Docker

From a fresh clone, prefer the repo-root bootstrap (`node scripts/setup.mjs` then `pnpm dev`). It starts this Compose file for you.

Development uses Compose for PostgreSQL and Redis only. Host ports are **55432** (Postgres) and **6380** (Redis) so they do not collide with local installs on 5432 / 6379.

```bash
node scripts/setup.mjs
pnpm dev
```

`docker-compose.yml` builds the full stack (no local Node required after Docker is installed):

```bash
cp .env.example .env
docker compose up --build
```

Nginx is optional:

```bash
docker compose --profile proxy up -d
```
