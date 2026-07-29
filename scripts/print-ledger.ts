/**
 * Verifies the append-only ledger design end to end:
 *  1. Raises two invoices for the seeded same-state customer (CGST/SGST path).
 *  2. Records a partial payment against the customer as a ledger credit.
 *  3. Prints the full ledger history with running balance, and re-derives the
 *     balance independently from SUM(debit) - SUM(credit) to prove the two agree.
 *
 * Run with: npx tsx scripts/print-ledger.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createSaleInvoice, round2 } from "../src/lib/gst-invoice";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const CUSTOMER_ID = "00000000-0000-0000-0000-000000000101"; // SRPRO TECHNOWORLD LLP (same state)
const ITEM_5PCT = "00000000-0000-0000-0000-000000000201";
const ITEM_18PCT = "00000000-0000-0000-0000-000000000203";

async function recordPayment(amount: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CUSTOMER_ID}))`;

    const payment = await tx.payment.create({
      data: {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        amount,
        mode: "BANK_TRANSFER",
        status: "SUCCESS",
        referenceNo: `MANUAL-${Date.now()}`,
      },
    });

    const lastEntry = await tx.ledgerEntry.findFirst({
      where: { tenantId: TENANT_ID, customerId: CUSTOMER_ID },
      orderBy: { createdAt: "desc" },
    });
    const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
    const runningBalance = round2(previousBalance - amount);

    await tx.ledgerEntry.create({
      data: {
        tenantId: TENANT_ID,
        partyType: "CUSTOMER",
        customerId: CUSTOMER_ID,
        refType: "PAYMENT",
        paymentId: payment.id,
        debit: 0,
        credit: amount,
        runningBalance,
        description: `Payment received (${payment.referenceNo})`,
      },
    });

    return payment;
  });
}

async function main() {
  console.log("Raising invoice #1 (5% item x 10)...");
  const invoice1 = await createSaleInvoice({
    tenantId: TENANT_ID,
    customerId: CUSTOMER_ID,
    lines: [{ itemId: ITEM_5PCT, description: "Fire Bucket With Handle", hsnCode: "73102990", qty: 10, rate: 200, taxRate: 5 }],
  });
  console.log(`  -> ${invoice1.number}, total Rs. ${invoice1.total}`);

  console.log("Raising invoice #2 (18% item x 5)...");
  const invoice2 = await createSaleInvoice({
    tenantId: TENANT_ID,
    customerId: CUSTOMER_ID,
    lines: [{ itemId: ITEM_18PCT, description: "4 KG ABC Type Fire Extinguisher", hsnCode: "84241000", qty: 5, rate: 640, taxRate: 18 }],
  });
  console.log(`  -> ${invoice2.number}, total Rs. ${invoice2.total}`);

  console.log("Recording a partial payment of Rs. 1000...");
  await recordPayment(1000);

  const entries = await prisma.ledgerEntry.findMany({
    where: { tenantId: TENANT_ID, customerId: CUSTOMER_ID },
    orderBy: { createdAt: "asc" },
  });

  console.log("\nLedger history for SRPRO TECHNOWORLD LLP:");
  console.log("date".padEnd(26), "type".padEnd(10), "debit".padStart(10), "credit".padStart(10), "balance".padStart(12), " description");
  let recomputed = 0;
  for (const e of entries) {
    recomputed = round2(recomputed + Number(e.debit) - Number(e.credit));
    console.log(
      e.createdAt.toISOString().padEnd(26),
      e.refType.padEnd(10),
      Number(e.debit).toFixed(2).padStart(10),
      Number(e.credit).toFixed(2).padStart(10),
      Number(e.runningBalance).toFixed(2).padStart(12),
      " " + e.description
    );
  }

  const storedFinalBalance = Number(entries[entries.length - 1].runningBalance);
  console.log(`\nStored running balance (last entry):        Rs. ${storedFinalBalance.toFixed(2)}`);
  console.log(`Recomputed from SUM(debit) - SUM(credit):    Rs. ${recomputed.toFixed(2)}`);
  console.log(recomputed === storedFinalBalance ? "MATCH -- append-only ledger is internally consistent." : "MISMATCH -- investigate!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
