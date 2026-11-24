# QueueCare

Free, open-source OPD token and queue system for Indian hospitals and clinics. MIT licence.

> Status: **Phase 4 of 7** (adds live updates, the TV board with voice, patient self check-in and the token status page). Reports, backups, Hindi for every screen and the rest arrive in later phases.

## TV board and check-in

- **TV board:** log in as admin and open *Poster & TV* for the address of each board. Open it in the TV's browser and press OK once to turn on the sound. Set `APP_URL` (your server's LAN address) and `DISPLAY_KEY` in `.env` first.
- **Check-in poster:** print it from the same page. Patients scan it and open `/checkin`, then follow their turn at `/t/<code>`. See [SPEC.md](SPEC.md) and [DECISIONS.md](DECISIONS.md).

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

All use the password `queuecare123` and must change it on first login. Log in at http://localhost:3000/login.

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
