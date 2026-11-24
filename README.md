# QueueCare

Free, open-source OPD token and queue system for Indian hospitals and clinics. **MIT licence.**

No more standing in OPD lines: patients get a token at the desk or by scanning a QR code, wait anywhere, and are called on a TV board with a chime and a spoken call in **Hindi and English**. It runs on one ordinary computer inside your hospital. No cloud account, no paid service, no data leaves your server.

- **Digital tokens** per department each day, with priority for emergency, elderly, pregnant and disabled patients
- **TV board with voice** for any TV or Android TV stick: token numbers only, never names
- **Doctor console**: one big *Next* button, plus recall, skip and no-show
- **Self check-in** by QR code, and a live "your place in the queue" page on the patient's phone
- **Hindi and English** on every screen (more languages by translating one file)
- **Reports and CSV export** with no patient names; **audit log**
- **Privacy**: consent record, automatic anonymising after a set number of days, patient data export and erase
- **Encrypted nightly backups**, installable on phones (PWA)

## Install in three commands

You need a computer with [Docker](https://docs.docker.com/get-docker/) (2 GB of memory is enough).

```bash
git clone <repository-address> queuecare && cd queuecare
cp .env.example .env          # then open .env and change the secrets
docker compose up -d
```

Open **http://localhost:3000** (or `http://<server-ip>:3000` from other devices on the network) and check **/health**.

Then either:

- try it with demo data: `docker compose exec app npx prisma db seed` (4 departments, sample tokens and a week of history), or
- start for real: `docker compose exec app npx tsx scripts/create-admin.ts 9876543210 "Your Name"`

> The `.env.example` values are placeholders so the commands above run, but they are **not secret**. Before real use set your own `POSTGRES_PASSWORD`, `AUTH_SECRET`, `DISPLAY_KEY` and `BACKUP_PASSPHRASE` (and keep a copy of the passphrase: without it a backup cannot be opened).

**Everything else is in [ADMIN_GUIDE.md](ADMIN_GUIDE.md):** first-time setup, the TV board, the QR poster, HTTPS, backups and restore, updating, security checklist and troubleshooting.

## Live demo

**https://queuecare-ten.vercel.app/login** (sample data, shared logins, password `queuecare123`: admin 9000000001, clerk 9000000021, doctor 9000000011). It is a demo on free hosting, so please do not enter real patient details. For a real hospital, install it on your own computer as described above: the data then never leaves your building.

## Demo logins (after the seed)

All use the password `queuecare123` and must change it at first login (http://localhost:3000/login).

| Role | Phone |
| --- | --- |
| Admin | 9000000001 |
| Clerks | 9000000021, 9000000022 |
| Doctors | 9000000011 to 9000000014 |

## How it is built

Next.js 15 (App Router) + TypeScript, Tailwind, Prisma + PostgreSQL 16, Auth.js (phone + password), next-intl (English, Hindi), Server-Sent Events for the live screens, Zod, Vitest, Playwright, Docker Compose. See [SPEC.md](SPEC.md) for what it does and [DECISIONS.md](DECISIONS.md) for every choice made along the way.

## Develop

Needs Node 22 and a local PostgreSQL 16 (or `docker compose up -d db`).

```bash
cp .env.example .env          # set DATABASE_URL to use localhost instead of db
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

## Tests

```bash
npm run lint && npm run typecheck
npm run i18n:check        # every translation key exists in en.json and hi.json
npm test                  # 500+ unit and API tests (Vitest), no database needed
npm run test:e2e          # Playwright: a clerk, a doctor, a TV board and a patient's phone
```

The end-to-end tests drive a **running** QueueCare in a real browser and need the database reachable from your computer. For a Docker setup:

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d    # opens the database on 127.0.0.1 only
npx playwright install chromium                                         # once
npm run test:e2e
```

They create their own test department and logins (and switch them off afterwards), but they do add a few tokens: **never run them on a hospital's real database.** CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, types, translations, unit tests, the end-to-end tests on a fresh database, and builds the Docker images on every push and pull request.

[TEST_CHECKLIST.md](TEST_CHECKLIST.md) is a list of what to try by hand before going live, including the things no automatic test can check (the TV's voice, a real printer, a real phone).

## Contributing

Issues and pull requests are welcome. Please run the checks above first. To add a language, copy `messages/en.json` to `messages/<code>.json`, translate it, and add the code to `src/i18n/config.ts`.

## Licence

[MIT](LICENSE)
