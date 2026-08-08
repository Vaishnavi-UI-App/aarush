import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { attendanceDateBucket, reconcileStaleOpenDays } from "@/lib/attendance";

/** Today's live status for every non-owner staff member, plus a full calendar month
 * of per-day status for the admin's heatmap grid. `?month=YYYY-MM` defaults to the
 * current month. */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "allAttendance", "view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthParam = request.nextUrl.searchParams.get("month");
  const now = new Date();
  const [year, month] = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const daysInMonth = monthEnd.getUTCDate();
  const dateList = Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month - 1, i + 1)).toISOString().slice(0, 10));

  await reconcileStaleOpenDays(session.tenantId);

  const [staff, records] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: session.tenantId, roleRef: { isOwner: false } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { tenantId: session.tenantId, date: { gte: monthStart, lte: monthEnd } },
      include: { breaks: { where: { endAt: null }, select: { id: true } } },
    }),
  ]);

  const byUserDate = new Map<string, (typeof records)[number]>();
  for (const r of records) byUserDate.set(`${r.userId}:${r.date.toISOString().slice(0, 10)}`, r);

  const todayKey = attendanceDateBucket().toISOString().slice(0, 10);

  const staffOut = staff.map((u) => {
    const byDate: Record<string, string | null> = {};
    for (const d of dateList) {
      const rec = byUserDate.get(`${u.id}:${d}`);
      byDate[d] = rec ? rec.status : null;
    }
    const todayRec = byUserDate.get(`${u.id}:${todayKey}`);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      today: todayRec
        ? {
            recordId: todayRec.id,
            status: todayRec.status,
            checkInAt: todayRec.checkInAt,
            checkOutAt: todayRec.checkOutAt,
            isLate: todayRec.isLate,
            isOpen: !!todayRec.checkInAt && !todayRec.checkOutAt,
            onBreak: todayRec.breaks.length > 0,
          }
        : null,
      byDate,
    };
  });

  return NextResponse.json({ month: `${year}-${String(month).padStart(2, "0")}`, days: dateList, staff: staffOut });
}
