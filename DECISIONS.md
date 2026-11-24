# Decisions

Where SPEC.md was unclear, the simplest option was chosen and is recorded here.

## Phase 1

1. **Scaffold written by hand, not `create-next-app`.** The folder already contained SPEC.md, and the generator refuses or prompts in a non-empty folder. The result is the same layout (App Router, `src/`, Tailwind, `@/*` alias).
2. **Tailwind CSS v4** (CSS-first config in `globals.css`, no `tailwind.config.js`). It is what current shadcn/ui targets.
3. **shadcn/ui components are added by copying** (`src/components/ui/button.tsx`, `card.tsx`) plus `components.json`, so `npx shadcn add <name>` works later. Only the components Phase 1 needs exist.
4. **Prisma 6** (not 7), pinned to avoid the config-file and driver-adapter changes in v7. TypeScript 5.9, Node 22 in Docker (spec asks for Node 20 or newer).
5. **Column naming:** Prisma fields are camelCase; database tables and columns are snake_case via `@map`/`@@map`, matching the spec's field names.
6. **IDs are `cuid` strings.** `Token.code` is a separate 8-character public code (alphabet without 0/O/1/I/L), generated with `crypto.randomInt`.
7. **`Token.date` is a Postgres `DATE`** holding the hospital-local calendar date (Asia/Kolkata). The unique key is `(department_id, date, seq_no)` as specified. The "row lock" for the next `seq_no` will lock the Department row (`SELECT ... FOR UPDATE`) in Phase 3, so no counter table is needed.
8. **Added `User.must_change_password`** (not in section 4) to implement "forced password change on first login" from section 9. Seeded users have it set to true.
9. **`OpdSession.start_time` / `end_time` are `"HH:MM"` strings** in the hospital's local time, not timestamps.
10. **`QueueEvent.action` and `AuditLog.action` are free strings**, not enums, so new actions do not need migrations. Allowed values are enforced in code.
11. **Single-stage Dockerfile that keeps dev dependencies.** This makes `docker compose exec app npx prisma db seed` work as the spec's install steps say, at the cost of a larger image. Migrations are applied on container start (`prisma migrate deploy`).
12. **Initial migration is generated with `prisma migrate diff`** from the schema, because no database was available while scaffolding.
13. **`POSTGRES_PASSWORD` added to `.env.example`** so the database password is set in one place. `DATABASE_URL` must use the same password.
14. **`/api/health` and `/health` are public on purpose.** They return only up/down and row counts, no personal data. Docker uses the API route as its healthcheck. This is the only API route without a role check in Phase 1; all later routes follow the spec's "Who" column.
15. **Backup service and Caddy are not in `docker-compose.yml` yet.** Spec section 5 assigns backups to Phase 5.
16. **Seed is re-runnable.** Users, departments, rooms and doctors use upserts; the 50 demo tokens are only created if no tokens exist for today. Demo patients use fake names and phone numbers.
17. **Seed doctors are linked to the department's single room**, and each department gets one doctor, as the spec's seed list says (4 doctors).

## Phase 2

18. **Auth.js v5 (`next-auth@beta`)** with the Credentials provider and JWT sessions. v5 is still tagged beta but is the version built for the Next.js App Router. Session lifetime is 12 hours (one clinic shift).
19. **The JWT cookie is not trusted for authorisation.** Middleware uses it only to decide where to redirect the browser. Every API route calls `requireRole()` and every page calls `requirePageRole()`, and both re-read the user from the database. A deactivated user or a changed role therefore takes effect on the next request, not when the cookie expires.
20. **API routes are not covered by middleware** (excluded in the matcher). Each route checks its own role, as the master prompt requires. `tests/unit/api-roles.test.ts` loops over every admin route and every role to make sure none is missed.
21. **Forced password change is enforced in three places:** middleware redirects pages to `/change-password`, `requireRole()` returns 403 `PASSWORD_CHANGE_REQUIRED` for everything except `POST /api/me/password`, and pages redirect. After a successful change the user is signed out and logs in again, which avoids a stale session flag.
22. **Admin-set passwords are temporary.** Creating a user, or setting a password in the user edit form, sets `must_change_password`. Passwords must be 8 to 72 characters (bcrypt ignores bytes after 72). bcrypt cost is 12 as the spec says.
23. **Login does not reveal which phone numbers exist.** An unknown phone is compared against a dummy hash so the response time is the same. Login rate limiting is a Phase 5 item (spec: rate limits on public routes), so it is not in yet.
24. **Phone numbers are stored as 10 digits** starting 6 to 9. `+91`, `91` and `0` prefixes and spaces are accepted on input and removed.
25. **Role access to page areas:** `/admin` ADMIN only; `/desk` CLERK and ADMIN (spec: ADMIN may create tokens); `/doctor` DOCTOR only. After login each role lands on its own area.
26. **Admin API follows the spec table (GET, POST, PATCH)** with these additions and limits: `DELETE` exists only for OPD sessions (a wrong session otherwise could not be removed); departments and users are switched off with `active` instead of being deleted; a department's `token_prefix`, a room's department, and a doctor's login and department cannot change after creation (existing tokens and doctors depend on them).
27. **Safety rules on users:** an admin cannot change their own role or deactivate themselves (prevents locking everyone out); a user with a doctor profile cannot be given another role; creating a doctor profile sets the user's department to match.
28. **Generic admin screen.** The five setup screens share one client component (`AdminCrud`) driven by a field list, to keep the code small. Screens call the same `/api/admin/*` routes that are tested.
29. **Not in Phase 2:** the language toggle on the login page and Hindi text (next-intl is added in Phase 6, per the build phases); the check-in QR poster (needs `/checkin` from Phase 4); the CSP header (Phase 5 security work); `GET /api/departments` (Phase 3 with the queue APIs).
30. **`trustHost: true`** in Auth.js, because the app is reached by a LAN IP or hostname that is not known in advance. Session cookies are marked `Secure` automatically when the site is served over HTTPS (Caddy, Phase 5); on plain `http://` LAN access they cannot be.
31. **Audit log:** logins, password changes and every admin create, update and delete are written to `audit_logs` with the actor and IP. No names or phone numbers are stored in the log text.

## Phase 3

32. **Skip is implemented with a new column, `tokens.skip_hold`.** The spec says a skipped token "re-enters after the next 3 waiting tokens" and lists SKIPPED to WAITING as automatic. So a skipped token stays SKIPPED while `skip_hold` counts down by one for every patient the same doctor calls, then becomes WAITING again with its own priority and token number. The hold is 3, or fewer if fewer patients are waiting; when nobody else is waiting it returns at once. If the doctor presses Next and only skipped patients remain, they all return first. The engine can predict the call order (`predictCallOrder`), so "people ahead" is exact.
33. **A later emergency still goes first.** Because a returned patient competes by priority and token number, an emergency who arrives while a patient is skipped is called before them, and counts as one of the 3 calls.
34. **Whose queue is it.** A doctor's queue is the waiting tokens assigned to them plus tokens assigned to nobody ("any doctor"). Calling a token assigns it to the calling doctor. A doctor sees only their own queue; desk staff and admins see the whole department.
35. **Next, as pressed by a doctor:** refused with 409 while a called patient has not been started, skipped or marked no-show; automatically completes a patient who is still in consultation (so one press moves the line along); 409 "nobody is waiting" otherwise, with no change made.
36. **Who may do what (API table in the spec says DOCTOR, CLERK):** skip, recall, no-show, start, complete and transfer are open to doctors, clerks and admins (admin added because the spec lets admins create tokens). Cancel is clerk and admin only. Doctors are limited to their own department, and for skip, recall, no-show, start and complete to patients they called. `next` is doctors only.
37. **Recall** does not change the status. It adds one to `recall_count` and writes a `recall` event, which the TV board (Phase 4) will use to announce the token again.
38. **Cancel** is allowed for waiting, called, in-consult and skipped tokens. The spec says "any to CANCELLED"; done, no-show and cancelled tokens are final, so cancelling them is refused.
39. **Transfer** moves a waiting token to another doctor of the same department, or back to "any doctor". Moving to another department would need a new token number, so it is not allowed.
40. **Token numbers.** `seq_no` is the highest number of that department on the hospital's local date plus one, taken while the department row is locked (`SELECT … FOR UPDATE`), so parallel requests never clash (20 parallel creations gave 20 consecutive numbers). The local date uses `hospitals.timezone` (Asia/Kolkata), so numbering restarts at local midnight. The printed form is `MED-034` (3 digits, more if needed).
41. **Estimated wait** = average consult time of the doctor's last 20 finished patients × people ahead. If no history exists it uses 10 minutes. Consults of 0 minutes or over 3 hours are ignored (usually a forgotten Complete press). For a token assigned to nobody the department's last 20 are used.
42. **Consent at the desk.** The new-token form has a required tick box ("I have told the patient…") and each token creates a `ConsentRecord` (purpose "OPD queue", notice version `v1`, channel DESK). The proper notice text and versioning come in Phase 5.
43. **Patient search** needs the full 10-digit phone and returns at most 5 matches, so the patient list cannot be browsed. Staff screens show patient names and ages, never phone numbers. The phone number is not written to the audit log.
44. **Status API is built now.** `GET /api/tokens/:code/status` is public and returns no personal data. Its folder is named `[id]` (it holds the code) because Next.js allows only one dynamic name per level next to `/api/tokens/[id]/[action]`. Rate limits for public routes arrive in Phase 5. The patient page `/t/<code>` arrives in Phase 4, so the QR on the slip leads nowhere until then.
45. **NOTIFY** is sent inside each queue transaction on channel `queue_<departmentId>` with a small payload (type, action, token id, token label). There is no personal data in it. The listener and SSE are Phase 4; until then the desk and doctor screens re-read their data every 5 to 8 seconds.
46. **Slip and QR.** The QR is made in the browser with the free `qrcode` package and points to `APP_URL/t/<code>`. The slip prints through the browser print dialog with `@page { size: 58mm auto }`. It shows hospital, token number, department, doctor, room, time and the QR, and no patient name.
47. **Not enforced:** `max_tokens` and session hours on OPD sessions. The spec stores them but says nothing about refusing tokens, so desks can still issue tokens early or late.
48. **The audit trail of a skip** has two entries, `queue.skip` and later `queue.requeue`, so both the skip and the moment the patient came back are recorded. Every queue action also writes a `queue_events` row in the same transaction.
