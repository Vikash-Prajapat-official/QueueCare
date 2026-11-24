# QueueCare

Free, open-source OPD token and queue system for Indian hospitals and clinics. MIT licence.

> Status: **Phase 1 of 7** (scaffold, database schema, Docker, seed, health page). Login, queues, TV board and the rest arrive in later phases. See [SPEC.md](SPEC.md) and [DECISIONS.md](DECISIONS.md).

## Run with Docker

```bash
cp .env.example .env          # then edit the secrets
docker compose up -d
docker compose exec app npx prisma db seed
```

Open http://localhost:3000 and then http://localhost:3000/health. The health page should show the database as connected and, after seeding, 4 departments, 7 users and 50 tokens.

## Run without Docker (development)

Needs Node 20+ and a local PostgreSQL 16.

```bash
cp .env.example .env          # set DATABASE_URL to use localhost instead of db
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

## Demo logins (from the seed)

All use the password `queuecare123` and must change it on first login (login arrives in Phase 2).

| Role | Phone |
| --- | --- |
| Admin | 9000000001 |
| Clerks | 9000000021, 9000000022 |
| Doctors | 9000000011 to 9000000014 |

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
