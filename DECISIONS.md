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
