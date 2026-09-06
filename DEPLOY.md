# Deploying to a VPS

Assumes: a VPS with Docker + Docker Compose already installed, a domain's A
record already pointed at the VPS's IP, and a host-level nginx + Certbot in
front of Docker (this VPS is shared with other apps, so nginx -- not a
container -- owns ports 80/443 and terminates TLS for every domain on the
box). The `app` container publishes to `127.0.0.1:3200`, and nginx proxies
the app's domain to that port; see `/etc/nginx/sites-enabled/` on the VPS
for the existing site config.

## 1. Get the code onto the VPS

```bash
git clone <your-repo-url> arush
cd arush
```

(Or `git pull` if it's already cloned from a previous deploy.)

## 2. Configure environment

```bash
cp .env.example .env
nano .env   # or vim/whatever
```

Fill in every value. For production specifically:

- `POSTGRES_PASSWORD` -- a strong password, only used between the `app` and
  `postgres` containers.
- `DOMAIN` -- the domain pointed at this VPS (e.g. `billing.example.com`).
  Point nginx's site config at it and issue/renew its certificate with
  Certbot (`certbot --nginx -d <DOMAIN>`).
- `APP_BASE_URL` -- set to `https://<DOMAIN>` (used in emails/links and the
  Razorpay webhook return URL).
- `SESSION_SECRET` -- generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `DATABASE_URL` in `.env` is not used in production (docker-compose.prod.yml
  builds it from `POSTGRES_PASSWORD`), but Prisma CLI commands run outside
  Docker read it, so leave the example value or point it at the container if
  you need to run Prisma commands from the host.
- Razorpay/SMTP/WhatsApp keys -- use live credentials, not test-mode ones.

## 3. Add the nginx site config

Only 80 and 443 need to be reachable from the internet; nginx terminates TLS
and proxies to `127.0.0.1:3200` (the app container's published port).
Postgres is not exposed. Add a server block for `DOMAIN` under
`/etc/nginx/sites-enabled/` (see other configs there for the pattern), then
`certbot --nginx -d <DOMAIN>` to provision its certificate, and
`nginx -t && systemctl reload nginx`.

## 4. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This starts two containers: `postgres` and `app`, with `app` published to
`127.0.0.1:3200`. The app container's entrypoint runs `prisma migrate deploy`
automatically before `next start`, so schema migrations apply on every
deploy without a manual step.

## 5. Verify

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

Then visit `https://<DOMAIN>` in a browser.

## 6. Seed the first tenant (first deploy only)

```bash
docker compose -f docker-compose.prod.yml exec app npx prisma db seed
```

Skip this on later deploys -- it's only for creating the initial
tenant/customers/items/owner user.

## Redeploying after a code change

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

The entrypoint re-runs `prisma migrate deploy`, which is a no-op if there are
no new migrations.

## Razorpay webhook

Once live, set the Razorpay Dashboard webhook URL to
`https://<DOMAIN>/api/webhooks/razorpay` and make sure `RAZORPAY_WEBHOOK_SECRET`
in `.env` matches what's configured there.
