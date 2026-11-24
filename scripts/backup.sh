#!/usr/bin/env bash
# Encrypted backup of the QueueCare database (pg_dump -> AES-256 with gpg).
# Runs nightly inside the "backup" container, and can be run by hand:
#   docker compose exec backup /scripts/backup.sh
# Keeps the last BACKUP_KEEP_DAYS days (default 14) in /backups (the ./backups folder on the server).
set -euo pipefail

: "${PGHOST:?PGHOST is not set}" "${PGUSER:?PGUSER is not set}" "${PGDATABASE:?PGDATABASE is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"

case "$BACKUP_PASSPHRASE" in
  replace-with*) echo "Refusing to back up: BACKUP_PASSPHRASE is still the example value. Set a strong one in .env." >&2; exit 1 ;;
esac

DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
out="$DIR/queuecare-$stamp.dump.gpg"
tmp="$out.partial"
trap 'rm -f "$tmp"' EXIT

# The dump goes straight into the encryption, so no readable copy is ever written to disk.
pg_dump --format=custom --no-owner --no-privileges "$PGDATABASE" \
  | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
        --symmetric --cipher-algo AES256 --output "$tmp" 3<<<"$BACKUP_PASSPHRASE"

[ -s "$tmp" ] || { echo "Backup file is empty" >&2; exit 1; }

# Check that the file can be decrypted and read back before keeping it.
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$tmp" 3<<<"$BACKUP_PASSPHRASE" \
  | pg_restore --list >/dev/null

mv "$tmp" "$out"
trap - EXIT

find "$DIR" -maxdepth 1 -name 'queuecare-*.dump.gpg' -mtime "+$KEEP" -delete

echo "backup ok: $out ($(du -h "$out" | cut -f1)); backups older than $KEEP days are removed"
