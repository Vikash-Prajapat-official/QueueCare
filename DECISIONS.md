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
