# syntax=docker/dockerfile:1

FROM node:20-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# NODE_ENV=production is set further down, AFTER `npm ci`/`npm run build` -- setting it
# earlier makes npm skip devDependencies (vitest, @types/*), which next build's own
# type-checker needs even though they're never used at runtime.

# System Chromium for Puppeteer (PDF generation) -- see src/lib/puppeteer-launch-options.ts
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time-only placeholders -- next build never opens a DB connection or sends
# mail/webhooks, it just needs these to exist so module-level guards (e.g. in
# src/lib/session.ts) don't throw while Next traces routes. Real values come from
# docker-compose's env_file at container runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV SESSION_SECRET="build-time-placeholder-only-not-used-at-runtime"
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "start"]
