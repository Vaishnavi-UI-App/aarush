import type { Prisma } from "@/generated/prisma/client";
import { round2 } from "@/lib/gst-invoice";

type Tx = Prisma.TransactionClient;

/** Recomputes every ledger entry's running balance for a customer from scratch, in
 * insertion order -- needed whenever an entry is removed from (or added back into)
 * the middle of the history, since every entry after it is then off by that amount.
 *
 * Lives in its own module because both the payment code and the invoice code need
 * it, and importing it from either one into the other would be circular. */
export async function recomputeCustomerLedgerBalances(tx: Tx, tenantId: string, customerId: string) {
  const entries = await tx.ledgerEntry.findMany({
    where: { tenantId, customerId },
    orderBy: { createdAt: "asc" },
  });
  let balance = 0;
  for (const entry of entries) {
    balance = round2(balance + Number(entry.debit) - Number(entry.credit));
    if (Number(entry.runningBalance) !== balance) {
      await tx.ledgerEntry.update({ where: { id: entry.id }, data: { runningBalance: balance } });
    }
  }
}
