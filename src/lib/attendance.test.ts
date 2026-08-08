import { describe, expect, it } from "vitest";
import { attendanceDateBucket } from "./attendance";

describe("attendanceDateBucket -- overnight shift root cause", () => {
  it("buckets a check-in before midnight IST and a check-out after midnight IST into two different days", () => {
    // 23:30 IST on 2026-03-10 (= 18:00 UTC on 2026-03-10)
    const checkIn = new Date("2026-03-10T18:00:00.000Z");
    // 06:00 IST on 2026-03-11, i.e. the very next morning (= 00:30 UTC on 2026-03-11)
    const checkOut = new Date("2026-03-11T00:30:00.000Z");

    const checkInBucket = attendanceDateBucket(checkIn);
    const checkOutBucket = attendanceDateBucket(checkOut);

    // This is the root cause of the overnight-shift bug: recordPunch() looks up "today's"
    // AttendanceRecord via attendanceDateBucket(new Date()) on every call. A night-shift
    // worker's check-out lands on a *different* bucket than their check-in, so the
    // check-out call finds no record and no open punch, and recordPunch() throws
    // "You haven't checked in yet" -- even though they very much did, 30 minutes ago.
    // See attendance.record-punch.test.ts for the end-to-end reproduction.
    expect(checkInBucket.getTime()).not.toBe(checkOutBucket.getTime());
  });
});

describe("recordPunch input validation -- NaN passes the API's typeof check", () => {
  it("typeof NaN is 'number', so `typeof lat !== \"number\"` does not reject it", () => {
    // This is the exact guard used in src/app/api/attendance/check-in/route.ts and
    // check-out/route.ts: `if (typeof lat !== "number" || typeof lng !== "number" ...)`.
    // NaN and Infinity both satisfy typeof === "number" in JavaScript, so a client can
    // send a garbage-but-numeric-typed lat/lng and the route will proceed to persist it
    // into a Prisma Decimal column, which throws on non-finite values -- turning a
    // client input-validation problem into an unhandled 500, not a clean 400.
    expect(typeof NaN).toBe("number");
    expect(typeof Infinity).toBe("number");
  });
});
