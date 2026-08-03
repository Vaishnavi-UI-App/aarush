import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewAllAttendance } from "@/lib/permissions";
import AttendanceAdminView from "./AttendanceAdminView";
import AttendanceCheckInOut from "./AttendanceCheckInOut";

// See src/app/api/attendance/check-in/route.ts for why this must be UTC-midnight of the
// local calendar day, not a local setHours(0,0,0,0) Date serialized as-is.
function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function serializeRecord(r: {
  id: string;
  date: Date;
  checkInAt: Date | null;
  checkOutAt: Date | null;
}) {
  return {
    id: r.id,
    date: r.date.toISOString(),
    checkInAt: r.checkInAt ? r.checkInAt.toISOString() : null,
    checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : null,
    hours: r.checkInAt && r.checkOutAt ? (r.checkOutAt.getTime() - r.checkInAt.getTime()) / 3_600_000 : null,
  };
}

export default async function AttendancePage() {
  const session = await getServerSession();

  if (await canViewAllAttendance(session!.tenantId, session!.role)) {
    const staff = await prisma.user.findMany({
      where: { tenantId: session!.tenantId, role: { not: "OWNER" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });

    return (
      <div>
        <h1 className="afs-page-title">Attendance</h1>
        <p className="afs-page-subtitle">Everyone&apos;s check-in / check-out history, with location and photo</p>
        <div style={{ marginTop: 20 }}>
          <AttendanceAdminView staff={staff} />
        </div>
      </div>
    );
  }

  const [records, today] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { tenantId: session!.tenantId, userId: session!.userId },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.attendanceRecord.findUnique({
      where: { tenantId_userId_date: { tenantId: session!.tenantId, userId: session!.userId, date: startOfToday() } },
    }),
  ]);

  return (
    <div>
      <h1 className="afs-page-title">Attendance</h1>
      <p className="afs-page-subtitle">Check in when you start, check out when you finish</p>
      <div style={{ marginTop: 20 }}>
        <AttendanceCheckInOut records={records.map(serializeRecord)} today={today ? serializeRecord(today) : undefined} />
      </div>
    </div>
  );
}
