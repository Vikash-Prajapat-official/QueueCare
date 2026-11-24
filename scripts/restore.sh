#!/usr/bin/env bash
# Restore an encrypted backup into a NEW database, so nothing existing is overwritten.
#   docker compose exec backup /scripts/restore.sh /backups/queuecare-20261124-020000.dump.gpg queuecare_restored
# Then check the data, and see ADMIN_GUIDE.md to switch the app over to the restored database.
set -euo pipefail

file="${1:?Usage: restore.sh <backup.dump.gpg> <new-database-name>}"
target="${2:?Usage: restore.sh <backup.dump.gpg> <new-database-name>}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"

[ -f "$file" ] || { echo "No such file: $file" >&2; exit 1; }
[[ "$target" =~ ^[a-z][a-z0-9_]{0,40}$ ]] || { echo "Use a simple lower-case database name, for example queuecare_restored" >&2; exit 1; }

created=0
finished=0
# If anything fails (wrong passphrase, damaged file) do not leave an empty database behind.
cleanup() {
  if [ "$created" = 1 ] && [ "$finished" != 1 ]; then
    dropdb --if-exists "$target" >/dev/null 2>&1 || true
    echo "Restore failed, so the new database \"$target\" was removed." >&2
  fi
}
trap cleanup EXIT

createdb "$target"   # fails if the database already exists, which is the safety we want
created=1

gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$file" 3<<<"$BACKUP_PASSPHRASE" \
  | pg_restore --no-owner --no-privileges --dbname "$target"
finished=1

echo "restored $file into database \"$target\""
