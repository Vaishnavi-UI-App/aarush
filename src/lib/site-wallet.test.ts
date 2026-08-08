import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

/** Builds a fake Prisma transaction client (`tx`) backed by canned responses, matching
 * the shape site-wallet.ts's functions call. `update` calls are captured so tests can
 * assert on the exact numbers written to the wallet. */
function makeTx(opts: { fundAllocation?: unknown; site?: unknown; wallet: Record<string, number>; expense?: unknown }) {
  const walletUpdateCalls: { where: unknown; data: Record<string, unknown> }[] = [];
  const tx = {
    site: { findFirstOrThrow: vi.fn().mockResolvedValue(opts.site ?? { id: "site-1" }) },
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    siteWallet: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(opts.wallet),
      update: vi.fn().mockImplementation((args: { where: unknown; data: Record<string, unknown> }) => {
        walletUpdateCalls.push(args);
        return Promise.resolve({ ...opts.wallet, ...args.data });
      }),
    },
    fundAllocation: {
      findFirst: vi.fn().mockResolvedValue(opts.fundAllocation),
      update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "fund-a", ...args.data })),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "new-fund", ...args.data })),
    },
    expense: {
      findFirst: vi.fn().mockResolvedValue(opts.expense),
      update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "expense-1", ...args.data, site: {}, category: null, orderedBy: null })),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "new-expense", ...args.data, site: {}, category: null, orderedBy: null })),
    },
  };
  transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
  return { tx, walletUpdateCalls };
}

describe("deleteFundAllocation -- out-of-order deletion corrupts the wallet", () => {
  beforeEach(() => {
    transactionMock.mockReset();
  });

  it("re-derives the correct reimbursement/balance when deleting a non-most-recent fund allocation", async () => {
    const { deleteFundAllocation } = await import("./site-wallet");

    // Scenario, hand-traced:
    //   1. Manager fronts Rs 500 personally (totalPersonalSpent = 500, nothing funded yet).
    //   2. Fund A: +300 -> clears 300 of the 500 debt. reimbursedToPersonal=300, addedToBalance=0.
    //   3. Fund B: +400 -> clears the remaining 200 of debt, banks the rest.
    //      reimbursedToPersonal=200, addedToBalance=200.
    //   Wallet after both: totalFundsReceived=700, totalPersonalReimbursed=500, companyBalance=200.
    //
    // Now delete Fund A. If Fund A had never existed, only Fund B (400) would ever have
    // been applied against the 500 debt: reimbursedToPersonal=400, addedToBalance=0,
    // companyBalance=0. That is the only value that makes the ledger add up.
    const fundA = { id: "fund-a", siteId: "site-1", amount: 300, reimbursedToPersonal: 300, addedToBalance: 0 };
    const walletBeforeDelete = {
      totalFundsReceived: 700,
      totalPersonalReimbursed: 500,
      companyBalance: 200,
      totalPersonalSpent: 500,
      totalCompanySpent: 0,
    };
    const { tx, walletUpdateCalls } = makeTx({ fundAllocation: fundA, wallet: walletBeforeDelete });

    await deleteFundAllocation("tenant-1", "fund-a");

    expect(tx.fundAllocation.delete).toHaveBeenCalledWith({ where: { id: "fund-a" } });
    const written = walletUpdateCalls[0].data;

    // These are the only values consistent with "Fund A never happened": Fund B (400)
    // alone against a 500 debt reimburses 400 and banks nothing.
    expect(written.totalPersonalReimbursed).toBe(400);
    expect(written.companyBalance).toBe(0);
  });

  it("never lets companyBalance go negative when deleting a fund whose money was already spent", async () => {
    const { deleteFundAllocation } = await import("./site-wallet");

    // Site was funded Rs 1000 (no prior debt, so all of it landed in companyBalance),
    // then Rs 800 of it was spent. Deleting that same Rs 1000 fund allocation now must
    // not drive the wallet's spendable balance negative -- Rs -800 is not a real amount
    // of money and corrupts every stat tile and site card that reads companyBalance.
    const fundAllocation = { id: "fund-1", siteId: "site-1", amount: 1000, reimbursedToPersonal: 0, addedToBalance: 1000 };
    const walletBeforeDelete = {
      totalFundsReceived: 1000,
      totalPersonalReimbursed: 0,
      companyBalance: 200, // 1000 received - 800 already spent
      totalPersonalSpent: 0,
      totalCompanySpent: 800,
    };
    const { walletUpdateCalls } = makeTx({ fundAllocation, wallet: walletBeforeDelete });

    await deleteFundAllocation("tenant-1", "fund-1");

    const written = walletUpdateCalls[0].data;
    expect(Number(written.companyBalance)).toBeGreaterThanOrEqual(0);
  });
});

describe("updateFundAllocation -- reducing an out-of-order fund allocation", () => {
  beforeEach(() => {
    transactionMock.mockReset();
  });

  it("re-derives correct totals rather than blindly subtracting the old amount", async () => {
    const { updateFundAllocation } = await import("./site-wallet");

    // Same starting point as above (Fund A=300/reimb 300, Fund B=400/reimb 200/added 200,
    // totalPersonalSpent=500), but this time Fund A's amount is corrected from 300 to 100
    // instead of being deleted outright.
    const fundA = { id: "fund-a", siteId: "site-1", amount: 300, reimbursedToPersonal: 300, addedToBalance: 0 };
    const walletBeforeEdit = {
      totalFundsReceived: 700,
      totalPersonalReimbursed: 500,
      companyBalance: 200,
      totalPersonalSpent: 500,
      totalCompanySpent: 0,
    };
    const { walletUpdateCalls } = makeTx({ fundAllocation: fundA, wallet: walletBeforeEdit });

    await updateFundAllocation({ tenantId: "tenant-1", fundAllocationId: "fund-a", amount: 100 });

    // Correct re-derivation: with Fund A now only 100, total ever received is 500
    // (100 + Fund B's 400) against a 500 debt -- every rupee should be reimbursement,
    // none of it should be sitting in companyBalance.
    const written = walletUpdateCalls[0].data;
    expect(Number(written.totalFundsReceived)).toBe(500);
    expect(Number(written.companyBalance)).toBe(0);
  });
});
