#!/usr/bin/env bash
# Starts the nightly backup schedule (02:00 server time, see TZ). cron jobs do not see the
# container's environment, so the settings are saved to a private file that the job loads.
set -euo pipefail

umask 077
: > /etc/backup.env
for name in PGHOST PGUSER PGPASSWORD PGDATABASE BACKUP_PASSPHRASE BACKUP_KEEP_DAYS BACKUP_DIR TZ; do
  if [ -n "${!name:-}" ]; then printf 'export %s=%q\n' "$name" "${!name}" >> /etc/backup.env; fi
done

echo '0 2 * * * . /etc/backup.env; /scripts/backup.sh >> /proc/1/fd/1 2>&1' > /etc/crontabs/root
echo "backup schedule set: every night at 02:00 ($(date +%Z)), keeping ${BACKUP_KEEP_DAYS:-14} days"
exec crond -f -l 8
