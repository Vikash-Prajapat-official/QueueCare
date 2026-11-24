# QueueCare

Free, open-source OPD token and queue system for Indian hospitals and clinics. MIT licence.

> Status: **Phase 5 of 7** (adds reports and CSV export, consent records, the nightly retention job, encrypted nightly backups, rate limits and the audit log screen). The landing page, Hindi for every screen and PWA, then tests, CI and the admin guide, arrive in later phases.

## Backups

Every night at 02:00 the `backup` service saves an encrypted copy of the database to the `backups` folder next to `docker-compose.yml` and keeps 14 days. Set a strong `BACKUP_PASSPHRASE` in `.env` and keep a copy of it somewhere safe: **without it a backup cannot be opened**. Copy the `backups` folder to another disk or computer now and then.

```bash
docker compose exec backup /scripts/backup.sh                       # back up now
docker compose exec backup /scripts/restore.sh /backups/<file>.dump.gpg queuecare_restored   # restore into a NEW database
```

On Windows Git Bash, put `MSYS_NO_PATHCONV=1` in front of these commands.

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
