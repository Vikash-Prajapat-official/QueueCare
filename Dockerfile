# QueueCare app image. Single stage on purpose: the image keeps dev dependencies so that
# `docker compose exec app npx prisma db seed` works on the hospital server (see DECISIONS.md).
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
