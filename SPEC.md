QueueCare: OPD Token and Queue System Spec

QueueCare is a free, open-source OPD token and queue system for Indian hospitals and clinics: digital tokens, a live TV board with voice calling, a doctor console and patient self check-in, installable in one afternoon.
Build it in VS Code with Claude Code
Save this doc as SPEC.md in an empty folder, open the folder in VS Code, and paste the master prompt below into Claude Code. Then paste the phase prompts one at a time.
One-time setup (about 20 minutes)
1.  Install Node.js 20 LTS or newer, Git, and Docker Desktop (on Windows, turn on WSL 2 when Docker asks).
2.  Create an empty folder called queuecare and open it in VS Code (File > Open Folder).
3.  Put this spec in the folder as SPEC.md. Open the Export menu under this doc's title, choose Markdown, then move the downloaded file into the folder and rename it SPEC.md.
4.  Open Claude Code in VS Code (the Claude icon in the sidebar, or Ctrl+Esc / Cmd+Esc).
5.  Paste the master prompt. When Claude Code asks to edit files or run commands, read the request and approve.
6.  After each phase, run the app (docker compose up -d then open http://localhost:3000) and click around before pasting the next phase prompt.
7.  Optional: create an empty GitHub repo and ask Claude Code "push this to my GitHub repo <url>".
Master prompt (paste first)
You are building QueueCare, a free open-source OPD token and queue system
for Indian hospitals. The complete spec is in SPEC.md in this folder.
Read the whole of SPEC.md before writing any code.

Rules for the whole project:
- Use exactly the tech stack in SPEC.md (Next.js 15 App Router + TypeScript,
  Tailwind + shadcn/ui, Prisma + PostgreSQL 16, Auth.js credentials,
  next-intl with English and Hindi, Server-Sent Events, Zod, Vitest,
  Playwright, Docker Compose). Do not add paid services.
- Work in the phases listed in SPEC.md section "Build phases". Do only
  Phase 1 now, then stop and tell me how to run and check it.
- Commit to git after each phase with a clear message.
- Every API route checks the user's role on the server.
- Keep a DECISIONS.md file: whenever the spec is unclear, choose the
  simplest option, write it down there, and continue. Ask me only if a
  choice would change what the product does.
- Never show patient names on the TV display.

Start Phase 1 now.
Phase prompts (paste one at a time, after checking the previous phase)
Phase 2: Do Phase 2 from SPEC.md (auth, roles, admin setup screens).
Add tests for role checks. Stop and tell me how to check it.
Phase 3: Do Phase 3 from SPEC.md (token creation, queue engine, all queue
APIs, doctor console). Write the Vitest unit tests for queue ordering,
priorities, skip re-entry and daily reset first, then make them pass.
Phase 4: Do Phase 4 from SPEC.md (realtime SSE, TV display board with
voice announcement, patient self check-in and token status page).
Phase 5: Do Phase 5 from SPEC.md (reports, CSV export, consent records,
retention job, encrypted nightly backups, rate limits, audit log screen).
Phase 6: Do Phase 6 from SPEC.md (landing page at / exactly as specified,
Hindi translations for every screen, PWA install).
Phase 7: Do Phase 7 from SPEC.md (Playwright end-to-end tests, GitHub
Actions CI, README with 3-command install, ADMIN_GUIDE.md, seed demo data).
Run all tests and fix failures. Then give me a final checklist of what to
test by hand before showing it to a hospital.
If something goes wrong
• Paste the exact error into Claude Code and say "fix this".
• If Docker will not start on Windows, ask Claude Code: "set up the project to run without Docker using a local PostgreSQL install".
• If a session gets long and slow, start a new Claude Code conversation and say: "Read SPEC.md and DECISIONS.md, check git log, and continue from the next unfinished phase".
Principles and tech stack
Principles
• Free and self-hosted: MIT licence, one docker compose up -d, runs on a 2 GB RAM Linux PC or a free cloud tier. No paid API is needed for the MVP.
• Cheap devices: mobile-first web app (PWA) usable on a low-end Android phone, and a TV display that runs in any TV or Android TV stick browser.
• Works without internet: runs fully on the hospital LAN. SMS is the only optional outbound call.
• Hindi and English from day one, with translation files so other languages can be added.
• Privacy by design: minimum data, role-based access, audit log, auto-anonymisation of old patient data, encrypted backups.
Tech stack
Layer
Choice
Frontend
Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui
Realtime
Server-Sent Events from Next.js route handlers, fed by Postgres LISTEN/NOTIFY
Backend
Next.js route handlers and server actions; Zod validation on every input
Database
PostgreSQL 16 via Prisma ORM
Auth
Auth.js (credentials: phone + password, bcrypt), roles stored on User
i18n
next-intl (en, hi); fonts Inter + Noto Sans Devanagari
PWA
Serwist (or next-pwa) for install and offline shell
Tests
Vitest (unit, API), Playwright (end to end), k6 (load, optional)
Packaging
Dockerfile + docker-compose.yml: app, postgres, backup
CI
GitHub Actions: lint, typecheck, test, build image
Folder structure
queuecare/
  SPEC.md  DECISIONS.md  README.md  ADMIN_GUIDE.md  LICENSE (MIT)
  docker-compose.yml  Dockerfile  .env.example
  prisma/schema.prisma  prisma/seed.ts
  src/app/(marketing)/page.tsx        landing page
  src/app/(app)/desk/...              registration desk
  src/app/(app)/doctor/...            doctor console
  src/app/(app)/admin/...             setup and reports
  src/app/display/[departments]/      TV board (no login, display key)
  src/app/checkin/  src/app/t/[code]/ patient pages
  src/app/api/...                     route handlers
  src/lib/queue.ts                    queue engine (pure functions, unit tested)
  src/lib/auth.ts  src/lib/sse.ts  src/lib/audit.ts
  messages/en.json  messages/hi.json
  tests/unit  tests/e2e
  scripts/backup.sh
Environment variables (.env.example)
Name
Example
Purpose
DATABASE_URL
postgresql://queuecare:change-me@db:5432/queuecare
Database
AUTH_SECRET
(random 32 bytes)
Session signing
APP_URL
http://192.168.1.10:3000
Used in QR codes and links
DISPLAY_KEY
(random string)
Lets TV screens open the board without a login
RETENTION_DAYS
90
Days before patient name and phone are anonymised
BACKUP_PASSPHRASE
(strong passphrase)
Encrypts nightly backups
SMS_PROVIDER
none
none, msg91 or fast2sms (later)
SMS_API_KEY

Only if SMS is on
Product spec
1. Problem and evidence
• Indian government OPDs see hundreds to thousands of patients a day, and most of their time goes in lines: first to register, then outside the doctor's door.
• When the National Health Authority added QR-code "Scan and Share" registration, it reported registration waiting time falling from about 50 minutes to 4 minutes at pilot hospitals, with about 4.06 lakh patients using it in 347 hospitals by Feb 2023 (Medical Dialogues, 14 Feb 2023). This is an official claim, not an independent study.
• In Bihar, after all 592 government facilities moved to electronic OPD registration, the average wait before seeing a doctor fell from 58 minutes (Aug 2024) to 35 minutes (May 2025) (ThePrint, 10 Jun 2025).
• The gap: Scan and Share speeds up registration, but most small hospitals, nursing homes and clinics have no free tool for the queue after registration: who is next for which doctor, how long the wait is, and calling the patient.
2. Users
Role
What they do
Registration clerk (CLERK)
Registers walk-ins, assigns department and doctor, prints or shows the token
Doctor (DOCTOR)
Presses Next, Skip, Recall, No-show, Complete; sees today's list
Patient (no login)
Self check-in by QR poster, watches TV board, checks status on phone
Admin (ADMIN)
Sets departments, rooms, doctors, sessions, users; views reports
TV display (DISPLAY_KEY)
Shows "Now serving" per room, with voice announcement
3. Features
MVP
• Departments, rooms, doctors and OPD sessions (for example Medicine, Mon to Sat, 9:00 to 13:00, Room 4), each department with a token prefix and colour.
• Token creation at the desk: name, phone, age, sex, optional ABHA number, visit type (new or follow-up), priority (normal, elderly 60+, pregnant, disabled, emergency). Search existing patient by phone.
• Token format MED-034, numbering resets daily per department.
• Patient self check-in at /checkin from a printed QR poster: 3 fields + consent tick box, then the token on screen.
• Token status at /t/<code> (8-character unguessable code): position, people ahead, estimated wait = rolling average consult time of last 20 patients for that doctor x people ahead.
• Doctor console: big buttons Next, Skip (re-enters after the next 3 tokens), Recall, No-show, Complete; current patient card; waiting list.
• TV board: grid of rooms, current token large, next 3 tokens; chime + browser text-to-speech in Hindi and English ("Token MED 34, room number 4"). Token numbers only, never names.
• Print token slip on a 58 mm thermal printer through the browser print dialog (print CSS).
• Daily reports: tokens per department, average wait, average consult time, no-shows; CSV export.
• Login with roles; audit log of every queue action.
Later (v2+, do not build now)
• SMS / WhatsApp alerts when 3 people are ahead (pluggable provider).
• ABDM Scan and Share integration (needs NHA sandbox registration).
• Advance appointment slots mixed with walk-ins.
• Lab and pharmacy counters as extra queues.
• Arrival heatmap for staff planning.
4. Data model
Table
Fields
Hospital
id, name, address, logo_url, timezone (Asia/Kolkata), settings JSON
User
id, name, phone (unique), password_hash, role (ADMIN, CLERK, DOCTOR), department_id?, active, created_at
Department
id, name_en, name_hi, token_prefix (unique), color, active
Room
id, name, department_id
Doctor
id, user_id, department_id, room_id?, display_name
OpdSession
id, department_id, doctor_id?, weekday (0 to 6), start_time, end_time, max_tokens?
Patient
id, name, phone, age, sex (M, F, O), abha_number?, anonymised (bool), created_at
Token
id, code (unique, 8 chars), seq_no, date, department_id, doctor_id?, patient_id, visit_type (NEW, FOLLOW_UP), priority (NORMAL, ELDERLY, PREGNANT, DISABLED, EMERGENCY), status (WAITING, CALLED, IN_CONSULT, SKIPPED, NO_SHOW, DONE, CANCELLED), source (DESK, SELF), created_at, called_at?, started_at?, completed_at?, recall_count, skip_count
QueueEvent
id, token_id, action, actor_user_id?, at, meta JSON
ConsentRecord
id, patient_id, purpose, notice_version, given_at, channel (DESK, SELF)
AuditLog
id, actor_user_id?, action, entity, entity_id, at, ip
Rules:
• Unique (department_id, date, seq_no). Use a transaction with a row lock to get the next seq_no.
• Queue order: EMERGENCY first, then ELDERLY / PREGNANT / DISABLED, then NORMAL; within a group by seq_no. A skipped token re-enters after the next 3 waiting tokens.
• Allowed status moves: WAITING to CALLED; CALLED to IN_CONSULT, SKIPPED or NO_SHOW; IN_CONSULT to DONE; SKIPPED to WAITING (automatic); any to CANCELLED by CLERK or ADMIN. Anything else is refused.
5. Architecture
One Next.js app serves the desk, doctor console, TV board, patient pages, admin and landing page. Every queue change runs in one database transaction: update the Token, insert a QueueEvent, then NOTIFY queue_<departmentId>. A single listener in the server fans the notification out to SSE clients subscribed to that department. Screens reconnect automatically with backoff and reload state on reconnect. A small cron (node-cron in the app, or a separate container) runs the retention job nightly.
6. Screens
1.  Login (phone + password, language toggle).
2.  Desk: New token, with phone search, form, and result card (token number, QR to status page, Print).
3.  Desk: Today's queues, counts per department, move token to another doctor, cancel.
4.  Doctor console: current patient, big Next button, waiting list, today's done count.
5.  TV board /display/<departmentIds>?key=<DISPLAY_KEY>: full screen, dark, high contrast, auto-fit grid.
6.  Patient self check-in /checkin.
7.  Patient token status /t/<code>, auto-updating.
8.  Admin setup: departments, rooms, doctors, sessions, users; print QR poster for check-in.
9.  Admin reports: date range, charts, CSV export; audit log viewer.
7. APIs (JSON, Zod-validated)
Method and path
Purpose
Who
POST /api/auth/[...nextauth]
Log in / out
public
GET /api/departments
Departments with today's counts
logged in
POST /api/tokens
Create token at desk
CLERK, ADMIN
POST /api/checkin
Self check-in (5 per phone per day, 30 per IP per hour)
public
GET /api/tokens/:code/status
Position and estimated wait
public
POST /api/queue/:departmentId/next
Call next token for this doctor
DOCTOR
POST /api/tokens/:id/(skip, recall, no-show, start, complete, transfer, cancel)
Queue actions
DOCTOR, CLERK
GET /api/stream/:departmentId
SSE stream
logged in or display key
GET /api/reports/daily?from&to
Report data
ADMIN
GET /api/export/tokens.csv?from&to
CSV export
ADMIN
GET, POST, PATCH /api/admin/(departments, rooms, doctors, sessions, users)
Setup
ADMIN
Errors return { error: { code, message } } with proper HTTP status (400, 401, 403, 404, 409, 429).
8. Security and privacy
• Personal data: name, phone, age, sex, optional ABHA number. No diagnosis or clinical notes, ever.
• India's Digital Personal Data Protection (DPDP) Act 2023: the hospital is the data fiduciary. QueueCare supports it with a plain-language consent notice in Hindi and English (stored with version in ConsentRecord), collecting only what the queue needs, auto-anonymising name and phone after RETENTION_DAYS (counts are kept), an admin tool to export or delete one patient's data on request, and an audit log.
• TV board and status page never show names or phone numbers.
• bcrypt passwords (cost 12), httpOnly secure same-site cookies, server-side role checks on every route, rate limits on public routes, security headers (CSP, X-Frame-Options), input validation everywhere.
• HTTPS via Caddy in front of the app (optional service in docker-compose). Nightly pg_dump encrypted with BACKUP_PASSPHRASE (age or gpg), 14 days kept.
9. Deployment
• Hospital PC (recommended): Ubuntu 24.04 or Windows with Docker Desktop, 2 GB RAM. git clone, cp .env.example .env (edit secrets), docker compose up -d, then docker compose exec app npx prisma db seed for demo data. Open http://<server-ip>:3000 on desk PCs, phones and the TV.
• Free cloud pilot: Vercel (app) + Neon or Supabase (free Postgres). State in the privacy notice that data is with a cloud provider.
• Seed: demo hospital, 4 departments (Medicine, Paediatrics, Gynaecology, Orthopaedics), 1 admin, 2 clerks, 4 doctors, 50 tokens. Default logins printed in README and forced password change on first login.
10. Testing and acceptance
• Unit (Vitest): queue ordering with priorities, skip re-entry, daily reset, estimated wait, status move rules, token code uniqueness.
• API: every route with each role, allowed and forbidden.
• End to end (Playwright): clerk creates token, doctor presses Next, TV board updates within 2 seconds, patient status page shows "Your turn".
• Load (k6, optional): 50 open screens + 5 tokens per second for 10 minutes on a 2 GB machine, p95 API under 300 ms.
• Done means: all tests pass in CI, docker compose up -d works on a clean machine, every screen works in Hindi, Lighthouse 90+ on the landing page.
11. Landing page (at /)
• Hero: "No more standing in OPD lines." Sub: "Free, open-source token and queue system for hospitals and clinics. Set up in one afternoon." Buttons: Try the live demo, Install free. Visual: TV board mock-up showing "MED-034, Room 4".
• The problem: two stat cards (50 to 4 minutes; 58 to 35 minutes) with source links.
• How it works: 3 steps with icons: Get a token, Wait anywhere, Get called on screen.
• Features grid: digital tokens, TV display with voice, doctor console, self check-in QR, Hindi + English, reports.
• For whom: district hospitals, CHCs, nursing homes, private clinics.
• Privacy: "Names never shown on screen. Your data stays on your server."
• Install: 3 commands in a code box + link to ADMIN_GUIDE.md.
• FAQ: Is it really free? Do we need internet? Does it work with ABDM? What hardware do we need?
• Footer: GitHub link, MIT licence, contact email placeholder.
• Design: teal #0F766E and white, Inter / Noto Sans Devanagari, large type, mobile-first.
12. Build phases
1.  Scaffold Next.js + TypeScript + Tailwind + shadcn/ui, Prisma schema from section 4, Docker Compose (app + postgres), seed script, health check page.
2.  Auth.js login, roles, middleware, admin setup screens (departments, rooms, doctors, sessions, users).
3.  Token creation, queue engine in src/lib/queue.ts with unit tests, queue APIs, doctor console, desk screens.
4.  SSE realtime, TV board with voice, patient self check-in and status pages.
5.  Reports, CSV export, consent records, retention job, backups, rate limits, audit log viewer.
6.  Landing page, Hindi translations for every string, PWA.
7.  Playwright tests, GitHub Actions CI, README, ADMIN_GUIDE.md, final polish.