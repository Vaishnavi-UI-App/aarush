#!/bin/sh
set -e

# Applies any pending migrations before the app starts serving traffic. Safe to
# run on every container start -- prisma migrate deploy is a no-op when the
# database is already up to date.
npx prisma migrate deploy

exec npm run start
