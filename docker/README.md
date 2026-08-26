# Docker

Development uses Compose for PostgreSQL and Redis only. Host ports are **55432** (Postgres) and **6380** (Redis) so they do not collide with local installs on 5432 / 6379.

```bash
docker compose -f docker-compose.dev.yml up -d
pnpm dev
```

`docker-compose.yml` builds the full stack. Nginx is optional:

```bash
docker compose --profile proxy up -d
```
