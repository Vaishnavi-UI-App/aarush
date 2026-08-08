import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = vi.fn();
const siteFindFirstMock = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (cb: (tx: unknown) => unknown) => transactionMock(cb),
    site: { findFirst: siteFindFirstMock },
  },
}));

describe("recordPunch -- overnight shift check-out", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    siteFindFirstMock.mockClear();
  });

  it("lets a worker check out for a check-in made the previous calendar day (night shift)", async () => {
    const { recordPunch } = await import("./attendance");

    // A worker checked in yesterday at 23:30 IST and is checking out today at 06:00 IST.
    // recordPunch looks up "today's" AttendanceRecord via attendanceDateBucket(new Date())
    // -- which, for a genuinely correct implementation, must still find and close the
    // still-open session from yesterday's bucket rather than reporting "you haven't
    // checked in" for someone who very much has.
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      attendanceRecord: {
        // No record for *today's* bucket -- this is the exact state the current
        // implementation sees for a night-shift worker checking out after midnight.
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ id: "today-record", ...(args.data as object) })),
        update: vi.fn(),
      },
      attendancePunch: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await expect(
      recordPunch({ tenantId: "t1", userId: "u1", kind: "CHECK_OUT", lat: 18.5, lng: 73.8, photo: "data:x" })
    ).resolves.toBeDefined();
  });
});
