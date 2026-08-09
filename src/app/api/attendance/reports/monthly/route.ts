import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reconcileStaleOpenDays } from "@/lib/attendance";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

interface EmployeeSummary {
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  holidayDays: number;
  lateCount: number;
  totalHours: number;
  overtimeHours: number;
}

function summarize(records: { status: string; isLate: boolean; computedWorkHours: unknown; overtimeHours: unknown }[]): EmployeeSummary {
  return {
    presentDays: records.filter((r) => r.status === "PRESENT").length,
    absentDays: records.filter((r) => r.status === "ABSENT").length,
    halfDays: records.filter((r) => r.status === "HALF_DAY").length,
    leaveDays: records.filter((r) => r.status === "LEAVE").length,
    holidayDays: records.filter((r) => r.status === "HOLIDAY").length,
    lateCount: records.filter((r) => r.isLate).length,
    totalHours: records.reduce((sum, r) => sum + Number(r.computedWorkHours ?? 0), 0),
    overtimeHours: records.reduce((sum, r) => sum + Number(r.overtimeHours ?? 0), 0),
  };
}

/** Aggregated present/absent/half-day/leave/overtime/late summary for one employee's
 * month, plus the daily breakdown the report chart is built from. `?format=csv` returns
 * the daily breakdown as a downloadable CSV instead of JSON. `?userId=all` (owners/managers
 * only) instead returns every staff member's monthly summary in one table, since a single
 * combined daily chart across employees wouldn't be readable. */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const params = request.nextUrl.searchParams;
  const requestedUserId = params.get("userId") || session.userId;
  const monthParam = params.get("month");
  const format = params.get("format");

  const canViewAll = await can(session.tenantId, session.roleId, "allAttendance", "view");
  if (requestedUserId !== session.userId && !canViewAll) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const [year, month] =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

  if (requestedUserId === "all") {
    if (!canViewAll) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const staff = await prisma.user.findMany({
      where: { tenantId: session.tenantId, roleRef: { isOwner: false } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });

    const records = await prisma.attendanceRecord.findMany({
      where: { tenantId: session.tenantId, userId: { in: staff.map((s) => s.id) }, date: { gte: monthStart, lte: monthEnd } },
    });
    const recordsByUser = new Map<string, typeof records>();
    for (const r of records) {
      const list = recordsByUser.get(r.userId) ?? [];
      list.push(r);
      recordsByUser.set(r.userId, list);
    }

    const rows = staff.map((user) => ({ user, summary: summarize(recordsByUser.get(user.id) ?? []) }));

    if (format === "csv") {
      const header = "Employee,Email,Present Days,Absent Days,Half Days,Leave Days,Holiday Days,Late Count,Total Hours,Overtime Hours\n";
      const csvRows = rows
        .map((r) =>
          [
            r.user.name || r.user.email,
            r.user.email,
            r.summary.presentDays,
            r.summary.absentDays,
            r.summary.halfDays,
            r.summary.leaveDays,
            r.summary.holidayDays,
            r.summary.lateCount,
            r.summary.totalHours.toFixed(2),
            r.summary.overtimeHours.toFixed(2),
          ]
            .map(String)
            .map(csvEscape)
            .join(",")
        )
        .join("\n");
      return new NextResponse(header + csvRows + "\n", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attendance-all-employees-${monthLabel}.csv"`,
        },
      });
    }

    return NextResponse.json({ month: monthLabel, staff: rows });
  }

  await reconcileStaleOpenDays(session.tenantId, requestedUserId);

  const [user, records] = await Promise.all([
    prisma.user.findFirst({ where: { id: requestedUserId, tenantId: session.tenantId }, select: { id: true, name: true, email: true } }),
    prisma.attendanceRecord.findMany({
      where: { tenantId: session.tenantId, userId: requestedUserId, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
    }),
  ]);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const summary = summarize(records);

  const daily = records.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    status: r.status,
    hours: r.computedWorkHours != null ? Number(r.computedWorkHours) : 0,
    overtimeHours: r.overtimeHours != null ? Number(r.overtimeHours) : 0,
    isLate: r.isLate,
    isEarlyDeparture: r.isEarlyDeparture,
    isManualEntry: r.isManualEntry,
    isAutoClosed: r.isAutoClosed,
  }));

  if (format === "csv") {
    const header = "Date,Status,Hours,Overtime Hours,Late,Early Departure\n";
    const rows = daily
      .map((d) => [d.date, d.status, d.hours.toFixed(2), d.overtimeHours.toFixed(2), d.isLate ? "Yes" : "No", d.isEarlyDeparture ? "Yes" : "No"].map(String).map(csvEscape).join(","))
      .join("\n");
    return new NextResponse(header + rows + "\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${user.name || user.email}-${year}-${String(month).padStart(2, "0")}.csv"`,
      },
    });
  }

  return NextResponse.json({ user, month: `${year}-${String(month).padStart(2, "0")}`, summary, daily });
}
