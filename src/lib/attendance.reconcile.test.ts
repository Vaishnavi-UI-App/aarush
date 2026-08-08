import { beforeEach, describe, expect, it, vi } from "vitest";

const shiftConfig = {
  id: "shift-1",
  startTime: "09:30",
  endTime: "18:30",
  gracePeriodMins: 10,
  halfDayThresholdHrs: 4,
  fullDayThresholdHrs: 8,
  overtimeAfterHrs: 9,
};

const recordId = "rec-1";
const staleDate = new Date(Date.UTC(2026, 2, 10));
const checkInAt = new Date(Date.UTC(2026, 2, 10, 4, 0)); // 09:30 IST

const updateCalls: { where: unknown; data: Record<string, unknown> }[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    attendanceRecord: {
      findMany: vi.fn().mockResolvedValue([{ id: recordId, date: staleDate }]),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: recordId,
        tenantId: "t1",
        date: staleDate,
        checkInAt,
        checkInLat: 1,
        checkInLng: 1,
        checkInPhotoData: "x",
        // Check-in only, no check-out -- a worker who forgot to press the button at the
        // end of an otherwise completely ordinary, fully-worked day.
        punches: [{ id: "p1", kind: "CHECK_IN", at: checkInAt, lat: 1, lng: 1, photoData: "x", withinGeofence: null }],
        breaks: [],
        shiftConfig,
        user: { roleId: null },
      }),
      update: vi.fn().mockImplementation((args: { where: unknown; data: Record<string, unknown> }) => {
        updateCalls.push(args);
        return Promise.resolve({ checkOutAt: null, ...args.data });
      }),
    },
  },
}));

describe("reconcileStaleOpenDays -- auto-close vs. actual computed hours", () => {
  beforeEach(() => {
    updateCalls.length = 0;
  });

  it("does not contradict its own recomputed hours by hardcoding isEarlyDeparture: true", async () => {
    const { reconcileStaleOpenDays } = await import("./attendance");
    await reconcileStaleOpenDays("t1");

    // First update call is recomputeRecord's own write, driven honestly off the punches.
    // Second is reconcileStaleOpenDays's own follow-up write.
    expect(updateCalls).toHaveLength(2);
    const recomputeWrite = updateCalls[0].data;
    const autoCloseWrite = updateCalls[1].data;

    // recomputeRecord itself never marks this early (there's no closed session ending
    // before shift end -- there's no checkout at all yet).
    expect(recomputeWrite.isEarlyDeparture).toBe(false);

    // A worker clocked in at shift start and auto-closed at 23:59 IST (well past a full
    // 9-hour day) should not be flagged as having left early. The actual code hardcodes
    // `isEarlyDeparture: true` in this second write regardless of hours worked.
    expect(autoCloseWrite.isEarlyDeparture).toBe(false);
  });
});
