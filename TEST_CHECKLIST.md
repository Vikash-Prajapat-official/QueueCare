# Hand-test checklist

What to try yourself before QueueCare goes live. The automatic tests cover the logic and the main flow; these are the things only a person with the real equipment can check. Tick each one off.

Use a test machine with the demo data (`docker compose exec app npx prisma db seed`), or a fresh install with a few real-looking users.

## 1. Install and start

- [ ] On a clean computer: `git clone`, `cp .env.example .env`, edit the secrets, `docker compose up -d` works and `/health` shows the database connected.
- [ ] After a restart of the computer, QueueCare comes back by itself (`docker compose ps`).
- [ ] The app opens from **another device** on the network at `http://<server-ip>:3000`.

## 2. Setup (admin)

- [ ] Log in as admin; the forced password change works and you can log in again with the new password.
- [ ] Add a department, a room, a doctor user, the doctor profile and a session. Each appears in the lists.
- [ ] A user switched to *Inactive* is logged out at their next click.
- [ ] **Poster & TV** shows the TV addresses and the poster with a QR code.

## 3. The queue (clerk, doctor)

- [ ] Clerk creates tokens for: a normal patient, a 70-year-old, a pregnant patient, an emergency. The emergency is called first, then the elderly and pregnant, then normal.
- [ ] A returning patient is found by phone number and the details are filled in.
- [ ] Print slip: on a **real 58 mm thermal printer** the slip fits, the QR code scans and opens the status page.
- [ ] Doctor presses **Next**, then *Start consult* and *Complete*. Try *Recall*, *Skip* (the patient comes back after a few calls) and *No-show*.
- [ ] Two doctors in one department each get their own patients; a clerk can move a waiting token to another doctor and cancel one.
- [ ] Open the doctor console on a **low-end Android phone**: buttons are large enough and nothing is cut off.

## 4. TV board

- [ ] The TV's browser opens the board address from **Poster & TV**. Text is readable from the back of the waiting room.
- [ ] Press OK on the yellow button: a chime plays and the next call is spoken in **Hindi and English** ("Token MED 34, room number 4"). Is the Hindi voice clear? If not, install a Hindi text-to-speech voice.
- [ ] The board updates within about 2 seconds of the doctor pressing Next.
- [ ] No patient name appears anywhere on the board.
- [ ] Unplug the TV's network for a minute: the board says *Reconnecting…* and recovers by itself.
- [ ] The screen does not go to sleep after 30 minutes.

## 5. Patients' phones

- [ ] Scan the poster's QR code with an ordinary phone camera: the check-in page opens in the phone's language.
- [ ] Check in with name, phone, age; you land on a status page showing your place and waiting time.
- [ ] When the doctor calls the token, the phone page changes to **It is your turn!** (and vibrates on phones that can).
- [ ] The same phone number cannot take more than 5 tokens in a day; pressing the button twice does not create two tokens.
- [ ] Switch the page to Hindi with the **हिन्दी** button; every word is Hindi and the choice is remembered.
- [ ] Over HTTPS (Caddy profile), the phone offers *Add to Home screen*. With the network off, the installed app shows the offline page and no patient data.

## 6. Hindi

- [ ] Go through the clerk, doctor and admin screens in Hindi: anything still in English, cut off, or not reading naturally?
- [ ] Department names show in Hindi in Hindi mode.

## 7. Reports and privacy

- [ ] **Reports** shows the demo history; counts and averages look sensible. *Download CSV* opens in Excel with Hindi text correct and no patient names or phone numbers.
- [ ] **Audit log** lists the logins and queue actions you just did, with no patient names.
- [ ] **Privacy → patient request:** find a patient by phone, download their data, erase them; the erased patient shows as anonymised and the reports keep their counts.
- [ ] Check the consent notice reads properly to a patient (desk and check-in page).

## 8. Backups

- [ ] `docker compose exec backup /scripts/backup.sh` creates a file in `backups/`.
- [ ] **Restore it on another machine** (or into a new database) with the passphrase, and the data is there. A wrong passphrase is refused.
- [ ] The `backups` folder is copied to a USB drive or another computer, and the passphrase is stored away from the server.

## 9. Security

- [ ] Wrong password 10 times locks that phone for 15 minutes.
- [ ] A clerk cannot open `/admin`; a doctor cannot open `/desk`.
- [ ] The TV address with a wrong key refuses to open.
- [ ] The server's port 3000 is **not** reachable from outside the hospital network.
- [ ] No demo user remains, and `.env` has your own secrets.

## 10. A busy day

- [ ] With 50 tokens in the system, several phones on the status page and two TVs open, the desk and doctor screens stay quick.
- [ ] Leave it running for a full OPD morning; nothing needs a restart.
