This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database & billing engine

```bash
docker compose up -d          # starts local Postgres on port 5433
npx prisma migrate dev        # applies schema
npx prisma db seed            # seeds a tenant, 2 customers, 3 items, an owner user
npx tsx scripts/print-ledger.ts  # raises sample invoices + a payment, prints the ledger
npm run test                  # tax-split + webhook signature tests
```

### Ledger conventions (read this before touching `ledger_entries`)

The `ledger_entries` table is the single source of truth for a customer's full history and
current outstanding due. It is **append-only**.

- **Sign convention**: `debit` increases what the customer owes us (an invoice being
  raised); `credit` decreases it (a payment received, a credit note). A customer's
  current due is always `SUM(debit) - SUM(credit)` for that customer, which is exactly
  what `runningBalance` on the latest row already holds -- it's stored redundantly on
  every insert purely so reads don't need to aggregate the whole table.
- **Never `UPDATE` or `DELETE` a row in `ledger_entries`.** If an invoice was raised in
  error or a payment needs reversing, insert a new offsetting entry (e.g. a credit equal
  to the original debit) rather than editing history. This is what makes the ledger
  auditable and safe against tax audits -- the full sequence of what happened is always
  reconstructable.
- **Every invoice/payment write and its ledger entry happen in the same
  `prisma.$transaction`.** See `createSaleInvoice` in `src/lib/gst-invoice.ts` and the
  webhook handler in `src/app/api/webhooks/razorpay/route.ts` for the pattern. Never
  split these into two separate transactions -- a crash between them would leave an
  invoice with no corresponding ledger entry (or vice versa).
- **Running balance writes are serialized per customer** via
  `pg_advisory_xact_lock(hashtext(customerId))` at the top of the transaction, so two
  concurrent invoice/payment writes for the same customer can't read the same "previous"
  balance and silently drop one of them. Invoice numbering uses the same pattern keyed
  on `tenantId`.
- **Tenant isolation**: every query in every route handler filters by `tenantId` taken
  from `requireSession(request)` (see `src/lib/session.ts`), never from the request body,
  query string, or a client-supplied header.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
