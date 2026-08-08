import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can, marksOwnAttendance } from "@/lib/permissions";
import { attendanceDateBucket, reconcileStaleOpenDays } from "@/lib/attendance";
import AttendanceTabs from "./AttendanceTabs";
import "./attendance.css";

export default async function AttendancePage() {
  const session = await getServerSession();
  const tenantId = session!.tenantId;
  const userId = session!.userId;

  const [canCheckIn, canViewAll] = await Promise.all([
    marksOwnAttendance(tenantId, session!.roleId),
    can(tenantId, session!.roleId, "allAttendance", "view"),
  ]);
  if (!canCheckIn && !canViewAll) redirect("/dashboard");

  const [mine, staff] = await Promise.all([
    canCheckIn
      ? (async () => {
          await reconcileStaleOpenDays(tenantId, userId);
          const [records, today, sites] = await Promise.all([
            prisma.attendanceRecord.findMany({ where: { tenantId, userId }, orderBy: { date: "desc" }, take: 30 }),
            prisma.attendanceRecord.findUnique({
              where: { tenantId_userId_date: { tenantId, userId, date: attendanceDateBucket() } },
              include: { punches: { orderBy: { at: "asc" } }, breaks: { orderBy: { startAt: "asc" } } },
            }),
            prisma.site.findMany({ where: { tenantId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
          ]);
          return { records, today, sites };
        })()
      : Promise.resolve({ records: [], today: null, sites: [] }),
    canViewAll
      ? prisma.user.findMany({
          where: { tenantId, roleRef: { isOwner: false } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const recordsDto = mine.records.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    status: r.status,
    computedWorkHours: r.computedWorkHours != null ? Number(r.computedWorkHours) : null,
    overtimeHours: r.overtimeHours != null ? Number(r.overtimeHours) : null,
    isLate: r.isLate,
    isAutoClosed: r.isAutoClosed,
    checkInAt: r.checkInAt ? r.checkInAt.toISOString() : null,
    checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : null,
  }));

  const todayDto = mine.today
    ? {
        id: mine.today.id,
        status: mine.today.status,
        isLate: mine.today.isLate,
        siteId: mine.today.siteId,
        punches: mine.today.punches.map((p) => ({
          id: p.id,
          kind: p.kind,
          at: p.at.toISOString(),
          withinGeofence: p.withinGeofence,
          distanceMeters: p.distanceMeters,
          photoData: p.photoData,
        })),
        breaks: mine.today.breaks.map((b) => ({ id: b.id, startAt: b.startAt.toISOString(), endAt: b.endAt ? b.endAt.toISOString() : null })),
      }
    : undefined;

  return (
    <div>
      <h1 className="afs-page-title">Attendance</h1>
      <p className="afs-page-subtitle">
        {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>
      <div style={{ marginTop: 20 }}>
        <AttendanceTabs canCheckIn={canCheckIn} canViewAll={canViewAll} today={todayDto} records={recordsDto} sites={mine.sites} staff={staff} />
      </div>
    </div>
  );
}
