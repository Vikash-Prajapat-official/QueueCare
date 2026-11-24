# QueueCare admin guide

For the person who sets up and looks after QueueCare in a hospital or clinic. You do not need to be a programmer, but you should be comfortable typing a few commands.

Contents: [What you need](#1-what-you-need) · [Install](#2-install) · [First-time setup](#3-first-time-setup) · [A normal day](#4-a-normal-day) · [TV board](#5-the-tv-board) · [Check-in poster](#6-the-check-in-poster) · [Phones and HTTPS](#7-phones-https-and-installing-the-app) · [Reports](#8-reports-and-csv) · [Privacy](#9-privacy-and-patient-requests) · [Backups and restore](#10-backups-and-restore) · [Updating](#11-updating) · [Security checklist](#12-security-checklist) · [Problems](#13-when-something-is-wrong) · [Settings](#14-settings-reference)

---

## 1. What you need

- **One computer to be the server.** A normal PC or a small server with **2 GB of memory**, running Ubuntu 24.04 or Windows with Docker Desktop. It stays switched on during OPD hours (and ideally all the time, so the night backup runs).
- **Docker** installed on it (with Docker Compose).
- A **network** all the devices share: the hospital Wi-Fi or LAN. **Internet is not needed** after the first download.
- Devices: a PC or phone for each registration clerk and doctor, and any TV or Android TV stick with a web browser for the queue board. A 58 mm thermal printer for token slips is optional.

Give the server a fixed address on your network (ask whoever manages your router for a "static IP" or "DHCP reservation"), for example `192.168.1.10`. Everything below uses that example.

## 2. Install

Open a terminal on the server and run:

```bash
git clone <repository-address> queuecare && cd queuecare
cp .env.example .env
docker compose up -d
```

Before the third command, open the new `.env` file in a text editor and **change the secrets** (see [section 12](#12-security-checklist)). At least set:

| Setting | What to put |
| --- | --- |
| `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` | the same strong password in both places |
| `AUTH_SECRET` | a long random text (run `openssl rand -base64 32`) |
| `DISPLAY_KEY` | a random text of 8 or more characters (the TV boards use it) |
| `APP_URL` | the server's address, for example `http://192.168.1.10:3000` |
| `BACKUP_PASSPHRASE` | a strong passphrase. **Write it down somewhere safe**: without it a backup cannot be opened. |

The first start downloads and builds everything and can take several minutes. Then check:

```bash
docker compose ps
```

All services should say `running` (the app and database say `healthy`). Open `http://192.168.1.10:3000/health`: it should show the database as connected.

### Option A: try it with demo data

```bash
docker compose exec app npx prisma db seed
```

This adds 4 sample departments, 7 sample users, today's sample tokens and a week of history for the reports. Use it on a test machine, or remove the demo departments and users before real use. Demo logins all use the password `queuecare123` and must change it at first login:

| Role | Phone |
| --- | --- |
| Admin | 9000000001 |
| Clerks | 9000000021, 9000000022 |
| Doctors | 9000000011 to 9000000014 |

### Option B: a real hospital, from nothing

Without the seed there is no user at all. Create the first administrator:

```bash
docker compose exec app npx tsx scripts/create-admin.ts 9876543210 "Your Name"
```

Use the admin's own mobile number. The command prints a temporary password **once**; the admin chooses their own at first login. Then follow section 3.

## 3. First-time setup

Log in at `http://192.168.1.10:3000/login` as the admin. Everything is under the **Admin** menu. Do these in order:

1. **Departments**: name in English and Hindi, and a short *token prefix* (for example `MED` makes tokens like `MED-034`). The prefix cannot be changed later.
2. **Rooms**: the consulting rooms of each department.
3. **Users**: one login for each clerk, doctor and extra admin (phone number and a temporary password). People choose their own password the first time they log in.
4. **Doctors**: link each doctor's login to a doctor profile: display name, department and room.
5. **Sessions**: the weekly OPD timetable (for example Monday to Saturday, 09:00 to 13:00).
6. **Poster and TV**: the TV addresses and the check-in poster (see sections 5 and 6).

Settings that are not on screen (retention days, backups, the display key) are in the `.env` file. After changing `.env`, run `docker compose up -d` again.

## 4. A normal day

- **Registration clerk** (menu *New token*): type the patient's phone number and press *Find earlier visit* for returning patients, otherwise fill in name, age and sex. Choose the department (and a doctor if the patient asked for one), tick the box after reading the consent notice to the patient, and press *Create token*. Press *Print slip* for a slip with a QR code, or tell the patient their number. Priority patients (emergency, elderly, pregnant, disabled) are called before normal ones.
- **Doctor** (menu *Doctor console*): press **Next** to call the next patient. The TV board shows and announces the token. Then *Start consult*, and *Complete* (or *Complete and call next*). If the patient is not there: *Recall*, *Skip* (they come back a little later) or *No-show*.
- **Patients** can follow their place from the QR code on the slip or poster, on their own phone, without installing anything.
- **Queues** (clerk and admin): a live view of every department, where a clerk can move a waiting token to another doctor or cancel it.

## 5. The TV board

1. In **Admin → Poster & TV** you will find one address per department, and one for *all departments* together. Each has the display key in it.
2. On the TV (or Android TV stick), open its web browser and type the address in. Make it the browser's home page or a bookmark.
3. **Press OK once** on the large yellow button. Browsers do not allow sound until someone presses something. After that, each call plays a chime and speaks the token in Hindi and English ("Token MED 34, room number 4").
4. Names are never shown or spoken: only the token, the room and the department.

Tips:

- Keep the TV awake: switch off its screensaver and sleep timer. The board also asks the browser to keep the screen on.
- Voices come from the TV's browser. If Hindi is silent, install a Hindi text-to-speech voice in the TV or stick's settings (on Android: *Text-to-speech output → Google* and download Hindi). The chime and the written board work without it.
- If the Wi-Fi drops, the board shows *Reconnecting…* and recovers by itself.
- Anyone with the address can see the board, so keep it to staff. To change the key, edit `DISPLAY_KEY` in `.env`, run `docker compose up -d`, and open the new addresses.

## 6. The check-in poster

**Admin → Poster & TV → Print check-in poster** makes an A4 poster in Hindi and English with a QR code. Stick it at the entrance and in the waiting area. A patient scans it, types name, phone number and age, taps a department, agrees to the notice, and gets a token on their own phone. The same phone number cannot take more than 5 tokens a day.

## 7. Phones, HTTPS and installing the app

The screens work in any browser, in **English and Hindi** (the switch is at the top of the page; the choice is remembered). Phones can also **install** QueueCare to the home screen, but browsers only allow that over **HTTPS** (or on `localhost`).

To get HTTPS on your network, QueueCare includes the Caddy web server:

1. Set `SITE_ADDRESS` in `.env` to the address people use (for example `192.168.1.10` or `queue.myhospital.in`) and `APP_URL` to `https://` plus the same.
2. Run `docker compose --profile https up -d`.
3. For a plain network address, Caddy makes its own certificate. Phones will warn once; install Caddy's root certificate on them or use a real domain name for a normal certificate.

(The HTTPS service is included but has been checked only on paper so far. Try it on a test machine first.)

The installed app never stores pages, queue data or patient details, so a shared phone keeps nothing.

## 8. Reports and CSV

**Admin → Reports** shows tokens per day and per department, completed and no-show counts, average waiting time (token to first call) and average consult time, and the share of self check-ins. **Download CSV** gives one row per token for Excel. The CSV never holds patient names, phone numbers or ages.

## 9. Privacy and patient requests

QueueCare collects only what the queue needs: name, phone number, age and sex (and an optional ABHA number). It never records the illness.

- **Consent:** a short notice in Hindi and English is shown at the desk (read it to the patient) and on the check-in page. Each token stores the notice version, the time and whether it was agreed at the desk or on the patient's phone.
- **Automatic anonymising:** every night at 02:30, patients not seen for `RETENTION_DAYS` (default 90) lose their name, phone and ABHA number. Visit counts and times stay, so reports remain correct. **Admin → Privacy** shows when it last ran.
- **A patient asks to see or delete their data:** **Admin → Privacy → A patient's data request.** Find them by their full phone number, *Download data (JSON)* to give them a copy, or *Erase data*. Both are written to the audit log.
- **Audit log:** **Admin → Audit log** lists who did what and when (logins, queue actions, setup changes, exports, privacy requests). It holds no patient names or phone numbers.

## 10. Backups and restore

**Backups run by themselves.** Every night at 02:00 the `backup` service writes an encrypted file to the `backups` folder next to `docker-compose.yml`, for example `queuecare-20261124-020000.dump.gpg`, and keeps the last 14 days. Files are encrypted with `BACKUP_PASSPHRASE`.

Two things only you can do:

1. **Keep the passphrase safe**, in a place other than the server. Without it a backup is useless.
2. **Copy the `backups` folder** to another disk or computer regularly (a USB drive once a week is a good start). A backup on the same machine does not help if that machine is lost.

**Back up right now:**

```bash
docker compose exec backup /scripts/backup.sh
```

**Restore** is done into a *new* database, so nothing is overwritten until you are sure:

```bash
# 1. Restore the file you want into a new database
docker compose exec backup /scripts/restore.sh /backups/queuecare-20261124-020000.dump.gpg queuecare_restored

# 2. Look at it
docker compose exec db psql -U queuecare -d queuecare_restored -c "SELECT count(*) FROM tokens;"
```

If the numbers look right, switch the app over to the restored data:

```bash
# 3. Stop the app and the backup service so nothing is using the databases
docker compose stop app backup

# 4. Keep the old database under another name, and give the restored one the live name
docker compose exec db psql -U queuecare -d postgres -c "ALTER DATABASE queuecare RENAME TO queuecare_old;"
docker compose exec db psql -U queuecare -d postgres -c "ALTER DATABASE queuecare_restored RENAME TO queuecare;"

# 5. Start again
docker compose up -d
```

The old data stays in `queuecare_old` until you remove it (`DROP DATABASE queuecare_old;`). On Windows Git Bash put `MSYS_NO_PATHCONV=1` in front of the commands that contain a path starting with `/`.

If you moved to a **new server**, install QueueCare there (section 2) with the **same `BACKUP_PASSPHRASE`**, copy your backup file into its `backups` folder, and follow the restore steps above.

A wrong passphrase, or a damaged file, stops the restore and leaves nothing behind.

## 11. Updating

```bash
git pull
docker compose up -d --build
```

The app applies database changes itself when it starts. Take a backup first (section 10).

## 12. Security checklist

- [ ] Changed `POSTGRES_PASSWORD`, `AUTH_SECRET`, `DISPLAY_KEY` and `BACKUP_PASSPHRASE` from the examples.
- [ ] Every demo user removed or given a new password; every real user has their own login.
- [ ] The `.env` file is not shared, e-mailed or committed to git.
- [ ] The server is reachable only inside the hospital network (do not forward port 3000 to the internet). If staff must reach it from outside, put it behind HTTPS (section 7) and a VPN.
- [ ] The `backups` folder is copied off the server and the passphrase is stored safely.
- [ ] A restore has been tried at least once, so you know it works before you need it.
- [ ] Staff who leave are switched off under **Admin → Users** (untick *Active*): it takes effect immediately.

QueueCare already limits repeated wrong logins (10 tries per phone in 15 minutes), checks the user's role on the server for every action, and sends no data to any outside service. Limits by IP address are only dependable behind a proxy such as the included Caddy (section 7).

## 13. When something is wrong

| Problem | What to do |
| --- | --- |
| Page does not open | `docker compose ps` should show the app `healthy`. Then `docker compose logs app --tail 50`. Check the server address and that devices are on the same network. |
| `/health` says the database is unreachable | `docker compose ps`, then `docker compose restart db app`. |
| A screen shows an old state | Refresh the page. Screens reconnect by themselves after a network drop. |
| A person cannot log in | Check the phone number, and that the user is *Active* under Users. Ten wrong tries lock that phone for 15 minutes; `docker compose restart app` clears the lock. |
| The TV is silent | Press OK on the yellow button; check the TV's volume; install a Hindi voice (section 5). |
| TV board says it needs a valid link | Open the exact address from *Poster & TV*; if you changed `DISPLAY_KEY`, use the new addresses. |
| Poster says `APP_URL is not set` | Set `APP_URL` in `.env` and run `docker compose up -d`. |
| "Install app" is not offered on a phone | It needs HTTPS (section 7). |
| Token numbers started again from 001 | Normal: numbering restarts every day, per department. |
| Disk is filling up | Old backups are removed after `BACKUP_KEEP_DAYS` days (default 14). Check `docker system df`. |

Nothing here solves it? Collect the output of `docker compose ps` and `docker compose logs app --tail 100` and ask on the project's GitHub issues page.

## 14. Settings reference

All in the `.env` file. After a change run `docker compose up -d`.

| Setting | Meaning |
| --- | --- |
| `DATABASE_URL`, `POSTGRES_PASSWORD` | Database connection. Inside Docker the host is `db`. |
| `AUTH_SECRET` | Signs login sessions. Changing it logs everyone out. |
| `APP_URL` | The server's address, used in QR codes and links. |
| `DISPLAY_KEY` | Lets a TV open the board without a login. |
| `RETENTION_DAYS` | Days before a patient's name, phone and ABHA number are anonymised (default 90). |
| `BACKUP_PASSPHRASE`, `BACKUP_KEEP_DAYS`, `BACKUP_TZ` | Backup encryption, how many days to keep, and the time zone of the 02:00 backup. |
| `SITE_ADDRESS` | Address for the optional HTTPS service. |
| `DISABLE_JOBS` | Set to `1` to switch off the nightly anonymising job. |
| `GITHUB_URL`, `DEMO_URL`, `CONTACT_EMAIL` | Optional links on the landing page. |
