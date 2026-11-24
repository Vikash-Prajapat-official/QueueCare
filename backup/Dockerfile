# Nightly encrypted database backups. Built from the project root (see docker-compose.yml).
FROM postgres:16-alpine

RUN apk add --no-cache bash gnupg tzdata

COPY scripts/backup.sh scripts/restore.sh scripts/backup-entrypoint.sh /scripts/
RUN chmod +x /scripts/*.sh

CMD ["/scripts/backup-entrypoint.sh"]
